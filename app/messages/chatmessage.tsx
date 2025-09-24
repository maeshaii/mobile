import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, FlatList, Platform, AppState, Alert, Keyboard, Dimensions, StatusBar } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { listMessages, markConversationRead, sendMessage as sendMessageApi, getWebSocketBase, getUserInfo, uploadAttachment } from '../../services/api';
import { ConversationWebSocket, TypingIndicator, WsEvent } from '../../services/websocketHelper';

const samplePic = require('../../assets/images/sample_pic.jpg');

type UiMsg = { 
  id: string; 
  text: string; 
  sent: boolean; 
  tempId?: string;
  sender_id?: number;
  sender_name?: string;
  created_at?: string;
  attachment_url?: string | null;
  message_type?: string;
};

const ChatMessageScreen = () => {
  const router = useRouter();
  const { conversationId, name } = useLocalSearchParams<{ conversationId: string; name: string }>();
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<ConversationWebSocket | null>(null);
  const typingIndicatorRef = useRef<TypingIndicator | null>(null);
  const hasMarkedAsRead = useRef(false);
  const typingTimeoutRef = useRef<any>(null);

  // Load current user
  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getUserInfo();
        setCurrentUser(user);
        console.log('Loaded current user:', user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    }
    loadUser();
  }, []);

  // Keyboard event listeners for manual handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        console.log('Keyboard showing, height:', e.endCoordinates.height);
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
        
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          console.log('Scrolling to bottom due to keyboard');
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 300);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        console.log('Keyboard hiding');
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Auto-scroll to bottom when messages change (like web)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    // Load initial messages - only when we have both conversationId and currentUser
    async function load() {
      if (!conversationId || !currentUser || !currentUser.id) {
        console.log('Skipping message load - missing data:', { conversationId, currentUser: !!currentUser, userId: currentUser?.id });
        return;
      }
      try {
        console.log('Loading messages for conversation:', conversationId, 'user:', currentUser.id);
        const data = await listMessages(Number(conversationId));
        const arr = Array.isArray(data?.results) ? data.results : [];
        const mapped: UiMsg[] = arr.map((m: any) => {
          const isMe = m?.sender?.is_me === true || m?.sender?.user_id === currentUser.id;
          console.log('Mapping message:', {
            message_id: m.message_id,
            content: m.content,
            sender_id: m.sender?.user_id,
            current_user_id: currentUser.id,
            is_me: m?.sender?.is_me,
            isMe,
            sent: isMe
          });
          return {
            id: String(m.message_id), 
            text: m.content, 
            sent: isMe,
            sender_id: m.sender?.user_id,
            sender_name: m.sender?.name,
            created_at: m.created_at,
            attachment_url: m.attachments?.[0]?.file_url || null,
            message_type: m.message_type
          };
        });
        
        // De-duplicate messages using byId map like web (exact same logic)
        const byId: Record<string, UiMsg> = {};
        mapped.forEach(m => { 
          // If we already have this message, prioritize based on sent status
          if (byId[m.id]) {
            if (m.sent && !byId[m.id].sent) {
              byId[m.id] = m; // Prefer sent version
            }
          } else {
            byId[m.id] = m;
          }
        });
        
        // Secondary de-duplication by content + timestamp + sender (like web)
        const finalUnique: UiMsg[] = [];
        const seen = new Set<string>();
        Object.values(byId).forEach(m => {
          const key = `${m.text}_${m.created_at}_${m.sender_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            finalUnique.push(m);
          }
        });
        
        console.log('De-duplicated messages:', finalUnique.length, 'from', mapped.length);
        setMessages(finalUnique);
        setNextCursor(data?.next_cursor || null);
        
        // Auto-scroll to bottom after loading messages (like web)
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 200);
      } catch (e) {
        console.warn('Failed to load messages', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conversationId, currentUser]);

  useEffect(() => {
    // Connect WebSocket - only when we have both conversationId and currentUser
    if (!conversationId || !currentUser || !currentUser.id) {
      console.log('Skipping WebSocket connection - missing data:', { conversationId, currentUser: !!currentUser, userId: currentUser?.id });
      return;
    }

    console.log('Connecting WebSocket for conversation:', conversationId, 'user:', currentUser.id);
    const ws = new ConversationWebSocket(Number(conversationId), getWebSocketBase());
    wsRef.current = ws;
    
    const typingIndicator = new TypingIndicator(ws);
    typingIndicatorRef.current = typingIndicator;

    ws.onStatus((status) => {
      console.log('WebSocket status:', status);
      if (status === 'connected') {
        // Mark conversation as read when connected
        if (!hasMarkedAsRead.current) {
          markConversationRead(Number(conversationId)).catch(() => {});
          hasMarkedAsRead.current = true;
        }
      }
    });

    ws.onMessage((event: WsEvent) => {
      if (!currentUser || !currentUser.id) {
        console.log('Skipping WebSocket message - no currentUser');
        return;
      }
      
      const myId = currentUser.id;
      console.log('WebSocket message received:', event.type, 'myId:', myId);
      
      switch (event.type) {
        case 'message':
          // Skip WebSocket echo for own messages (like web)
          if (event.sender_id === myId) {
            console.log('Skipping own message echo');
            break;
          }
          
          setMessages((prev) => {
            const id = String(event.message_id);
            const map: Record<string, UiMsg> = {};
            prev.forEach(m => { map[m.id] = m; });
            
            // De-duplicate with existing messages
            if (map[id]) {
              console.log('Message already exists, skipping duplicate');
              return prev;
            }
            
            const newMessage: UiMsg = {
              id,
              text: event.content,
              sent: false, // Received message
              sender_id: event.sender_id,
              sender_name: event.sender_name,
              created_at: event.created_at,
              attachment_url: event.attachment_url,
              message_type: event.message_type
            };
            
            console.log('Adding new message from WebSocket:', newMessage);
            return [...prev, newMessage];
          });
          break;
        case 'typing':
          // Handle typing indicators if needed
          break;
        case 'pong':
          console.log('WebSocket message received: pong myId:', myId);
          break;
      }
    });

    // Connect the WebSocket
    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [conversationId, currentUser]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && wsRef.current) {
        // Reconnect WebSocket when app becomes active
        wsRef.current.connect();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [conversationId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !currentUser || !currentUser.id) return;
    
    console.log('Sending message:', text, 'user:', currentUser.id);
    
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const tempMessage: UiMsg = {
      id: tempId,
      text,
      sent: true,
      tempId,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      created_at: new Date().toISOString(),
    };
    
    // Add temporary message immediately (optimistic UI)
    setMessages(prev => [...prev, tempMessage]);
    setInput('');
    
    // Clear any existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    try {
      const saved = await sendMessageApi(Number(conversationId), { content: text });
      console.log('Message sent successfully:', saved);
      
      // Replace temporary message with saved message
      setMessages(prev => prev.map(m => 
        m.tempId === tempId 
          ? {
              ...m,
              id: String(saved.message_id),
              tempId: undefined,
              created_at: saved.created_at,
            }
          : m
      ));
      
      console.log('Replaced temp message with saved message');
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temporary message on error
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
    
    // Scroll to bottom after sending
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    
    // Send typing indicator
    if (typingIndicatorRef.current) {
      typingIndicatorRef.current.sendTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (typingIndicatorRef.current) {
          typingIndicatorRef.current.sendTyping(false);
        }
      }, 2000);
    }
  };

  const loadMore = async () => {
    if (!conversationId || !nextCursor || isLoadingMore || !currentUser || !currentUser.id) return;
    setIsLoadingMore(true);
    try {
      console.log('Loading more messages with cursor:', nextCursor);
      const data = await listMessages(Number(conversationId), { cursor: nextCursor, limit: 50 });
      const arr = Array.isArray(data?.results) ? data.results : [];
      const mapped: UiMsg[] = arr.map((m: any) => {
        const isMe = m?.sender?.is_me === true || m?.sender?.user_id === currentUser.id;
        return {
          id: String(m.message_id), 
          text: m.content, 
          sent: isMe,
          sender_id: m.sender?.user_id,
          sender_name: m.sender?.name,
          created_at: m.created_at,
          attachment_url: m.attachments?.[0]?.file_url || null,
          message_type: m.message_type
        };
      });
      
      // De-duplicate with existing messages (exact same logic as web)
      setMessages((prev) => {
        const joined = [...mapped, ...prev];
        const byId: Record<string, UiMsg> = {};
        joined.forEach(m => { 
          if (byId[m.id]) {
            if (m.sent && !byId[m.id].sent) {
              byId[m.id] = m;
            }
          } else {
            byId[m.id] = m;
          }
        });
        
        const finalUnique: UiMsg[] = [];
        const seen = new Set<string>();
        Object.values(byId).forEach(m => {
          const key = `${m.text}_${m.created_at}_${m.sender_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            finalUnique.push(m);
          }
        });
        
        console.log('Loaded more messages:', finalUnique.length, 'from', joined.length);
        return finalUnique;
      });
      
      setNextCursor(data?.next_cursor || null);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleAttachmentPress = async () => {
    try {
      // Show action sheet for image vs document picker
      Alert.alert(
        'Select Attachment',
        'Choose the type of file you want to attach',
        [
          {
            text: 'Photo/Video',
            onPress: async () => {
              try {
                // Request permissions for image picker
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
                  return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.All,
                  allowsEditing: false, // Disable cropping
                  quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                  await uploadAndSendAttachment(result.assets[0]);
                }
              } catch (error) {
                console.error('Error with image picker:', error);
                Alert.alert('Error', 'Failed to select image. Please try again.');
              }
            },
          },
          {
            text: 'Document',
            onPress: async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({
                  type: '*/*',
                  copyToCacheDirectory: true,
                });

                if (!result.canceled && result.assets[0]) {
                  await uploadAndSendAttachment(result.assets[0]);
                }
              } catch (error) {
                console.error('Error with document picker:', error);
                Alert.alert('Error', 'Failed to select document. Please try again.');
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Attachment picker error:', error);
      Alert.alert('Error', 'Failed to open attachment picker');
    }
  };

  const uploadAndSendAttachment = async (file: any) => {
    if (!currentUser || !currentUser.id) return;
    
    try {
      console.log('Uploading attachment:', file);
      
      // Create proper file object for upload
      const fileObj = {
        uri: file.uri,
        type: file.type || 'application/octet-stream',
        name: file.name || 'attachment',
      };
      
      const attachment = await uploadAttachment(fileObj);
      console.log('Attachment uploaded:', attachment);
      
      // Determine message type based on file type
      const messageType = file.type?.startsWith('image/') ? 'image' : 'file';
      
      // Send message with attachment
      const message = await sendMessageApi(Number(conversationId), { 
        content: messageType === 'image' ? '📷 Image' : '📎 File',
        message_type: messageType,
        attachment_id: attachment.attachment_id
      });
      console.log('Message with attachment sent:', message);
      
      // Add message to UI
      const newMessage: UiMsg = {
        id: String(message.message_id),
        text: message.content || (messageType === 'image' ? '📷 Image' : '📎 File'),
        sent: true,
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        created_at: message.created_at,
        attachment_url: attachment.file_url,
        message_type: messageType,
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      
    } catch (error) {
      console.error('Attachment upload failed:', error);
      Alert.alert('Upload Failed', `Failed to upload attachment: ${(error as Error).message || 'Unknown error'}`);
    }
  };

  // Don't render until we have currentUser with id
  if (!currentUser || !currentUser.id) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.topBarTitle}>Loading user...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{name || 'Chat'}</Text>
        <View style={styles.topBarRight}>
          <Text style={styles.connectionStatus}>Connected</Text>
        </View>
      </View>

      {/* Main Chat Area - Manual keyboard handling */}
      <View style={styles.chatContainer}>
        {/* Messages Area - Dynamic height based on keyboard */}
        <View style={[
          styles.messagesArea,
          {
            marginBottom: isKeyboardVisible ? keyboardHeight : 0
          }
        ]}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => {
              // Auto-scroll when content size changes
              console.log('FlatList content size changed, scrolling to bottom');
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            onLayout={() => {
              // Auto-scroll when layout changes
              console.log('FlatList layout changed, scrolling to bottom');
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            renderItem={({ item }) => {
              if (!currentUser) {
                console.log('No currentUser, skipping message render');
                return null;
              }
              
              const myId = currentUser.id;
              const isActuallyMine = item.sent || item.sender_id === myId;
              
              console.log('Rendering message:', {
                id: item.id,
                text: item.text,
                sent: item.sent,
                sender_id: item.sender_id,
                myId,
                isActuallyMine
              });
              
              return (
                <View style={[
                  styles.messageContainer,
                  isActuallyMine ? styles.messageSent : styles.messageReceived
                ]}>
                  <View style={[
                    styles.messageBubble,
                    isActuallyMine ? styles.bubbleSent : styles.bubbleReceived
                  ]}>
                    {/* Sender label */}
                    <Text style={[
                      styles.senderLabel,
                      isActuallyMine ? styles.senderLabelSent : styles.senderLabelReceived
                    ]}>
                      {isActuallyMine ? 'You' : (item.sender_name || 'Unknown')}
                    </Text>
                    
                    {/* Message content */}
                    {item.attachment_url ? (
                      <Image 
                        source={{ uri: item.attachment_url }} 
                        style={styles.attachmentImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={[
                        styles.messageText,
                        isActuallyMine ? styles.messageTextSent : styles.messageTextReceived
                      ]}>
                        {item.text}
                      </Text>
                    )}
                    
                    {/* Timestamp */}
                    <Text style={[
                      styles.timestamp,
                      isActuallyMine ? styles.timestampSent : styles.timestampReceived
                    ]}>
                      {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : ''}
                    </Text>
                  </View>
                </View>
              );
            }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.1}
            contentContainerStyle={{ 
              paddingBottom: 20,
              flexGrow: 1
            }}
            ListEmptyComponent={
              loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading messages...</Text>
                </View>
              ) : null
            }
          />
        </View>

        {/* Input Bar - Fixed at bottom with keyboard offset */}
        <View style={[
          styles.inputBarContainer,
          {
            bottom: isKeyboardVisible ? keyboardHeight : 0
          }
        ]}>
          <View style={styles.inputBar}>
            <TouchableOpacity 
              onPress={handleAttachmentPress}
              style={styles.attachmentButton}
            >
              <FontAwesome name="paperclip" size={20} color="white" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Write a message..."
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              value={input}
              onChangeText={handleInputChange}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline={false}
              autoFocus={false}
              blurOnSubmit={false}
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
              <FontAwesome name="send" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C4E80',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  backButton: {
    marginRight: 15,
  },
  topBarTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionStatus: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  messagesArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messageContainer: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  messageSent: {
    alignItems: 'flex-end',
  },
  messageReceived: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginVertical: 2,
  },
  bubbleSent: {
    backgroundColor: '#1C4E80',
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: '#e0e0e0',
    borderBottomLeftRadius: 4,
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  senderLabelSent: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  senderLabelReceived: {
    color: '#666',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageTextSent: {
    color: 'white',
  },
  messageTextReceived: {
    color: '#333',
  },
  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginVertical: 4,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  timestampSent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  timestampReceived: {
    color: '#666',
  },
  inputBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1C4E80',
    paddingBottom: Platform.OS === 'ios' ? 34 : 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    paddingHorizontal: 15,
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    maxHeight: 100,
    minHeight: 20,
  },
  attachmentButton: {
    marginRight: 8,
    padding: 8,
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
});

export default ChatMessageScreen;
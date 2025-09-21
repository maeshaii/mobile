import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, FlatList, KeyboardAvoidingView, Platform, AppState, Alert } from 'react-native';
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
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const { name, conversationId } = useLocalSearchParams();
  const wsRef = useRef<ConversationWebSocket | null>(null);
  const typingIndicatorRef = useRef<TypingIndicator | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedAsRead = useRef(false);

  // Load current user info
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getUserInfo();
        console.log('Loaded current user:', user);
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load current user:', error);
      }
    };
    loadUser();
  }, []);

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
              console.log('Replacing received message with sent message:', m.id);
              byId[m.id] = m; // Replace with sent version
            } else if (!m.sent && byId[m.id].sent) {
              console.log('Keeping existing sent message, skipping received:', m.id);
              return; // Keep the sent version
            } else {
              console.log('Duplicate message with same sent status, keeping first:', m.id);
              return; // Keep the first one
            }
          } else {
            byId[m.id] = m;
          }
        });
        
        // Additional check: remove any remaining duplicates by content and timestamp
        const finalUnique: UiMsg[] = [];
        const seen = new Set<string>();
        Object.values(byId).forEach(m => {
          const key = `${m.text}_${m.created_at}_${m.sender_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            finalUnique.push(m);
          } else {
            console.log('Removing duplicate by content/timestamp:', m.id, m.text);
          }
        });
        const unique = finalUnique.sort((a, b) => 
          new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        );
        
        console.log('Loaded messages:', unique.length, 'unique messages');
        setMessages(unique);
        setNextCursor(data.next_cursor ?? null);
      } catch (e) {
        console.warn('Failed to load messages', e);
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
      setConnectionStatus(status);
      if (status === 'connected' && !hasMarkedAsRead.current) {
        // Mark conversation as read when connected
        markConversationRead(Number(conversationId)).catch(() => {});
        hasMarkedAsRead.current = true;
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
            map[id] = {
              id,
              text: event.content,
              sent: false, // This is a received message
              sender_id: event.sender_id,
              sender_name: event.sender_name,
              created_at: event.created_at,
              attachment_url: event.attachment_url || null,
              message_type: event.message_type
            };
            console.log('Added new message via WebSocket:', map[id]);
            return Object.values(map);
          });
          break;
        case 'typing':
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            if (event.is_typing) {
              newSet.add(event.user_id);
            } else {
              newSet.delete(event.user_id);
            }
            return newSet;
          });
          break;
        case 'read_receipt':
          // Handle read receipts if needed
          break;
      }
    });

    ws.connect();

    return () => {
      console.log('Disconnecting WebSocket');
      ws.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, currentUser]);

  // Mark as read when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (conversationId && !hasMarkedAsRead.current) {
        markConversationRead(Number(conversationId)).catch(() => {});
        hasMarkedAsRead.current = true;
      }
    }, [conversationId])
  );

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && conversationId && !hasMarkedAsRead.current) {
        markConversationRead(Number(conversationId)).catch(() => {});
        hasMarkedAsRead.current = true;
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
      sender_id: currentUser.user_id,
      sender_name: currentUser.full_name || 'You',
      created_at: new Date().toISOString(),
      message_type: 'text'
    };
    
    // Add temp message immediately (optimistic UI)
    setMessages((prev) => {
      console.log('Adding temp message:', tempMessage);
      return [...prev, tempMessage];
    });
    setInput('');
    
    // Stop typing indicator
    typingIndicatorRef.current?.sendTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      if (conversationId) {
        // Send via REST for persistence
        const saved = await sendMessageApi(Number(conversationId), { content: text, message_type: 'text' });
        console.log('Message saved:', saved);
        
        // Replace temp message with saved message (exact same as web)
        setMessages((prev) => {
          const updated = prev.map(m => {
            if (m.tempId === tempId) {
              const newMsg = {
                id: String(saved.message_id),
                text: saved.content,
                sent: true, // Keep as sent since it's our message
                sender_id: saved.sender?.user_id,
                sender_name: saved.sender?.name,
                created_at: saved.created_at,
                attachment_url: (saved as any).attachments?.[0]?.file_url || null,
                message_type: saved.message_type
              };
              console.log('Replacing temp message with saved:', newMsg);
              return newMsg;
            }
            return m;
          });
          return updated;
        });
      }
    } catch (e) {
      console.warn('Send failed', e);
      // Remove failed message from UI
      setMessages((prev) => {
        const filtered = prev.filter(m => m.tempId !== tempId);
        console.log('Removed failed message, remaining:', filtered.length);
        return filtered;
      });
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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
          // If we already have this message, prioritize based on sent status
          if (byId[m.id]) {
            if (m.sent && !byId[m.id].sent) {
              console.log('Replacing received message with sent message in loadMore:', m.id);
              byId[m.id] = m; // Replace with sent version
            } else if (!m.sent && byId[m.id].sent) {
              console.log('Keeping existing sent message in loadMore, skipping received:', m.id);
              return; // Keep the sent version
            } else {
              console.log('Duplicate message with same sent status in loadMore, keeping first:', m.id);
              return; // Keep the first one
            }
          } else {
            byId[m.id] = m;
          }
        });
        
        // Additional check: remove any remaining duplicates by content and timestamp
        const finalUnique: UiMsg[] = [];
        const seen = new Set<string>();
        Object.values(byId).forEach(m => {
          const key = `${m.text}_${m.created_at}_${m.sender_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            finalUnique.push(m);
          } else {
            console.log('Removing duplicate by content/timestamp in loadMore:', m.id, m.text);
          }
        });
        
        const unique = finalUnique.sort((a, b) => 
          new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        );
        console.log('Loaded more messages:', mapped.length, 'new, total unique:', unique.length);
        return unique;
      });
      setNextCursor(data.next_cursor ?? null);
    } catch (e) {
      console.warn('Failed to load more messages', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    
    // Send typing indicator
    if (text.length > 0) {
      typingIndicatorRef.current?.sendTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        typingIndicatorRef.current?.sendTyping(false);
      }, 2000) as any;
    } else {
      typingIndicatorRef.current?.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
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
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error showing attachment options:', error);
      Alert.alert('Error', 'Failed to show attachment options. Please try again.');
    }
  };

  const uploadAndSendAttachment = async (file: any) => {
    if (!conversationId) return;

    try {
      // Create proper file object for upload
      const fileObj = {
        uri: file.uri,
        type: file.mimeType || file.type || 'application/octet-stream',
        name: file.name || file.fileName || 'attachment',
      };

      console.log('Uploading file:', fileObj);

      // Upload the attachment
      const uploaded = await uploadAttachment(fileObj);
      console.log('Upload result:', uploaded);
      
      // Determine if it's an image
      const isImage = (uploaded.file_type || '').startsWith('image/');
      
      // Send message with attachment
      const saved = await sendMessageApi(Number(conversationId), {
        content: uploaded.file_name,
        message_type: isImage ? 'image' : 'file',
        attachment_id: uploaded.attachment_id
      });

      console.log('Message sent:', saved);

      // Add message to UI
      const newMessage: UiMsg = {
        id: String(saved.message_id),
        text: saved.content,
        sent: true,
        sender_id: saved.sender?.user_id,
        sender_name: saved.sender?.name,
        created_at: saved.created_at,
        attachment_url: uploaded.file_url,
        message_type: saved.message_type
      };

      setMessages(prev => [...prev, newMessage]);
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
        <Text style={styles.topBarTitle}>MESSAGES</Text>
      </View>
      {/* Removed NavBar placeholder; not a component here */}
      
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#1C4E80" />
        </TouchableOpacity>
        <Image source={samplePic} style={styles.avatar} />
        <Text style={styles.name}>{typeof name === 'string' ? name : 'Chat'}</Text>
        {/* Connection status indicator */}
        <View style={[styles.statusDot, { backgroundColor: 
          connectionStatus === 'connected' ? '#4CAF50' : 
          connectionStatus === 'connecting' ? '#FF9800' : '#F44336' 
        }]} />
      </View>
      <View style={styles.separator} />

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>
            {Array.from(typingUsers).length === 1 ? 'Someone is typing...' : 'Multiple people are typing...'}
          </Text>
        </View>
      )}

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={currentUser ? messages : []}
        keyExtractor={item => `${item.id}_${item.sent ? 'sent' : 'received'}_${item.sender_id || 'unknown'}`}
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
              isActuallyMine ? styles.messageContainerSent : styles.messageContainerReceived
            ]}>
              {/* Sender label */}
              <Text style={[
                styles.senderLabel,
                isActuallyMine ? styles.senderLabelSent : styles.senderLabelReceived
              ]}>
                {isActuallyMine ? 'You' : (item.sender_name || 'Them')}
              </Text>
              
              <View style={[
                styles.bubble,
                isActuallyMine ? styles.bubbleSent : styles.bubbleReceived
              ]}>
                {/* Image attachment */}
                {item.attachment_url && /\.(png|jpe?g|gif|webp)$/i.test(item.attachment_url) ? (
                  <Image 
                    source={{ uri: item.attachment_url }} 
                    style={styles.attachmentImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={[
                    styles.bubbleText,
                    isActuallyMine ? styles.bubbleTextSent : styles.bubbleTextReceived
                  ]}>
                    {item.text}
                  </Text>
                )}
              </View>
              
              {/* Timestamp */}
              {item.created_at && (
                <Text style={[
                  styles.timestamp,
                  isActuallyMine ? styles.timestampSent : styles.timestampReceived
                ]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.1}
        onEndReached={() => {}}
        ListHeaderComponent={nextCursor ? (
          <TouchableOpacity onPress={loadMore} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ color: '#1C4E80' }}>{isLoadingMore ? 'Loading…' : 'Load earlier messages'}</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
        style={styles.inputBarContainer}
      >
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
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <FontAwesome name="send" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    overflow: 'hidden' 
},
  topBar: {
    backgroundColor: '#1C4E80',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  topBarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    marginLeft: 10, 
    marginRight: 10
 },
  name: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    color: '#222' 
},
  separator: { 
    height: 2, 
    backgroundColor: '#F0F0F0', 
    width: '100%', 
    marginBottom: 8 
},
  messageContainer: {
    marginVertical: 4,
    marginHorizontal: 16,
  },
  messageContainerSent: {
    alignItems: 'flex-end',
  },
  messageContainerReceived: {
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginHorizontal: 4,
  },
  senderLabelSent: {
    color: '#1C4E80',
    opacity: 0.85,
  },
  senderLabelReceived: {
    color: '#666',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    padding: 12,
  },
  bubbleReceived: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 4,
  },
  bubbleSent: {
    backgroundColor: '#1C4E80',
    borderBottomRightRadius: 4,
  },
  bubbleText: { 
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextReceived: { 
    color: '#222' 
  },
  bubbleTextSent: { 
    color: '#fff' 
  },
  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 2,
    marginHorizontal: 4,
    opacity: 0.7,
  },
  timestampSent: {
    color: '#1C4E80',
  },
  timestampReceived: {
    color: '#666',
  },
  inputBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C4E80',
    paddingBottom: 8,
    paddingTop: 8,
    height: 80,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: '#1C4E80',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 50,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  attachmentButton: {
    marginRight: 8,
    padding: 6,
  },
  sendButton: {
    marginLeft: 8,
    padding: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default ChatMessageScreen;

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, FlatList, Platform, AppState, Alert, Keyboard, Dimensions, StatusBar, Modal, Linking } from 'react-native';
// Removed expo-video import due to SurfaceVideoView compatibility issues
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { listMessages, markConversationRead, sendMessage as sendMessageApi, getWebSocketBase, getUserInfo, uploadAttachment, api, MessageItem, getAccessToken, getRefreshToken } from '../../services/api';
import { ConversationWebSocket, TypingIndicator, WsEvent } from '../../services/websocketHelper';
import { getFileIcon, getFileTypeDisplayName, formatFileSize, isImageFile, isVideoFile, isAudioFile, FileCategory } from '../../utils/fileUtils';
import { deduplicateMessages, addMessageWithDeduplication, replaceTempMessage, removeTempMessage, isDuplicateMessage } from '../../utils/messageUtils';
import { sanitizeUserInput, validateMessageType } from '../../utils/securityUtils';
import { useLogger } from '../../utils/logger';

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
  attachment_info?: {
    file_name?: string;
    file_type?: string;
    file_category?: FileCategory;
    file_size?: number;
  };
};

const ChatMessageScreen = () => {
  const logger = useLogger('ChatMessageScreen');
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
  
  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFile, setDownloadFile] = useState<{url: string, name: string, type: string} | null>(null);
  
  // Image viewing state
  const [showImageModal, setShowImageModal] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  
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
        const mapped: UiMsg[] = arr.map((m: MessageItem) => {
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
            message_type: m.message_type,
            attachment_info: m.attachments?.[0] ? {
              file_name: m.attachments[0].file_name,
              file_type: m.attachments[0].file_type,
              file_category: m.attachments[0].file_category,
              file_size: m.attachments[0].file_size
            } : undefined
          };
        });
        
        // Use the new deduplication utility
        const finalUnique = deduplicateMessages(mapped);
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

    const connectWebSocket = async () => {
      try {
        // Establish session before WebSocket connection (optional for mobile)
        try {
          await api.get('api/csrf/'); // This will set session cookies
          console.log('CSRF session established');
        } catch (csrfError) {
          console.log('CSRF session failed, continuing with WebSocket connection:', csrfError);
          // Continue anyway - WebSocket can work without CSRF session
        }
        
        console.log('Connecting WebSocket for conversation:', conversationId, 'user:', currentUser.id);
        const wsBaseUrl = await getWebSocketBase();
        
        // Get JWT token for WebSocket authentication
        const token = await getAccessToken();
        console.log('WebSocket token available:', !!token);
        console.log('WebSocket token length:', token ? token.length : 0);
        console.log('WebSocket token preview:', token ? `${token.substring(0, 20)}...` : 'None');
        
        // If no token or token is expired, try to refresh it
        let validToken = token;
        if (!token) {
          console.log('No token available, attempting refresh...');
          try {
            const refreshToken = await getRefreshToken();
            if (refreshToken) {
              const response = await api.post('/api/token/refresh/', { refresh: refreshToken });
              if (response.data?.access) {
                await SecureStore.setItemAsync('accessToken', response.data.access);
                validToken = response.data.access;
                console.log('Token refreshed successfully');
              }
            }
          } catch (refreshError) {
            console.log('Token refresh failed:', refreshError);
            // Continue without token - WebSocket will fail but that's expected
          }
        }
        
        console.log('WebSocket token available:', !!validToken);
        console.log('WebSocket token preview:', validToken ? `${validToken.substring(0, 20)}...` : 'None');
        console.log('WebSocket token length:', validToken ? validToken.length : 0);
        console.log('WebSocket base URL:', wsBaseUrl);
        console.log('Creating WebSocket with token:', !!validToken);
        const ws = new ConversationWebSocket(Number(conversationId), wsBaseUrl, validToken || undefined);
        wsRef.current = ws;
    
    const typingIndicator = new TypingIndicator(ws);
    typingIndicatorRef.current = typingIndicator;

    // Create callback functions that can be properly cleaned up
    const statusCallback = (status: any) => {
      console.log('WebSocket status:', status);
      if (status === 'connected') {
        // Mark conversation as read when connected
        if (!hasMarkedAsRead.current) {
          markConversationRead(Number(conversationId)).catch(() => {});
          hasMarkedAsRead.current = true;
        }
      }
    };

    const messageCallback = (event: WsEvent) => {
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
              message_type: event.message_type,
              attachment_info: event.attachment_info
            };
            
            console.log('Adding new message from WebSocket:', newMessage);
            // Check if this is a duplicate before adding
            if (isDuplicateMessage(prev, newMessage)) {
              return prev;
            }
            return addMessageWithDeduplication(prev, newMessage);
          });
          break;
        case 'typing':
          // Handle typing indicators if needed
          break;
        case 'pong':
          console.log('WebSocket message received: pong myId:', myId);
          break;
      }
    };

    // Store callbacks for cleanup
    wsRef.current.statusCallback = statusCallback;
    wsRef.current.messageCallback = messageCallback;

    // Add callbacks
    ws.onStatus(statusCallback);
    ws.onMessage(messageCallback);

        // Connect the WebSocket
        ws.connect();
        } catch (error) {
          logger.error('Failed to establish session for WebSocket', error);
        }
    };

    connectWebSocket();

    return () => {
      // Clean up WebSocket callbacks to prevent memory leaks
      if (wsRef.current) {
        if (wsRef.current.statusCallback) {
          wsRef.current.removeStatusCallback(wsRef.current.statusCallback);
        }
        if (wsRef.current.messageCallback) {
          wsRef.current.removeMessageCallback(wsRef.current.messageCallback);
        }
        wsRef.current.disconnect();
      }
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
    try {
      // Sanitize input on client side as first line of defense
      const sanitizedText = sanitizeUserInput(input.trim());
      if (!sanitizedText || !currentUser || !currentUser.id) return;
    
      console.log('Sending message:', sanitizedText, 'user:', currentUser.id);
      
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const tempMessage: UiMsg = {
        id: tempId,
        text: sanitizedText,
        sent: true,
        tempId,
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        created_at: new Date().toISOString(),
      };
    
    // Add temporary message immediately (optimistic UI)
    setMessages(prev => addMessageWithDeduplication(prev, tempMessage));
    setInput('');
    
    // Clear any existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
      try {
        const saved = await sendMessageApi(Number(conversationId), { content: sanitizedText });
      console.log('Message sent successfully:', saved);
      
      // Replace temporary message with saved message using utility function
      const savedMessage: UiMsg = {
        ...tempMessage,
        id: String(saved.message_id),
        tempId: undefined,
        created_at: saved.created_at,
      };
      
        setMessages(prev => replaceTempMessage(prev, tempId, savedMessage));
        console.log('Replaced temp message with saved message');
      } catch (error) {
        console.error('Failed to send message:', error);
        // Remove temporary message on error
        setMessages(prev => removeTempMessage(prev, tempId));
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
      
      // Scroll to bottom after sending
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Input sanitization failed:', error);
      Alert.alert('Invalid Input', 'Invalid message content. Please check your input and try again.');
    }
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
      
      // De-duplicate with existing messages using utility function
      setMessages((prev) => {
        const joined = [...mapped, ...prev];
        const finalUnique = deduplicateMessages(joined);
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
      // Show action sheet for different file types
      Alert.alert(
        'Select Attachment',
        'Choose the type of file you want to attach',
        [
          {
            text: '📷 Photo/Image',
            onPress: async () => {
              try {
                // Request permissions for image picker
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
                  return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: false,
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
            text: '🎥 Video',
            onPress: async () => {
              try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Required', 'Please grant permission to access your media library.');
                  return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                  allowsEditing: false,
                  quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                  await uploadAndSendAttachment(result.assets[0]);
                }
              } catch (error) {
                console.error('Error with video picker:', error);
                Alert.alert('Error', 'Failed to select video. Please try again.');
              }
            },
          },
          {
            text: '📄 Documents (PDF, Word, Excel, etc.)',
            onPress: async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({
                  type: [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'text/plain',
                    'text/csv',
                    'application/zip',
                    'application/x-rar-compressed'
                  ],
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
        type: file.mimeType || file.type || 'application/octet-stream',
        name: file.fileName || file.name || 'attachment',
      };
      
      const attachment = await uploadAttachment(fileObj, Number(conversationId));
      console.log('Attachment uploaded:', attachment);
      
      // Determine message type and content based on file category
      let messageType: 'image' | 'video' | 'audio' | 'file' = 'file';
      let messageContent = '📎 File';
      
      switch (attachment.file_category) {
        case 'image':
          messageType = 'image';
          messageContent = '📷 Image';
          break;
        case 'video':
          messageType = 'video';
          messageContent = '🎥 Video File';
          break;
        case 'audio':
          messageType = 'audio';
          messageContent = '🎵 Audio File';
          break;
        case 'pdf':
          messageContent = '📄 PDF Document';
          break;
        case 'word':
          messageContent = '📝 Word Document';
          break;
        case 'excel':
          messageContent = '📊 Excel Spreadsheet';
          break;
        case 'powerpoint':
          messageContent = '📈 PowerPoint Presentation';
          break;
        case 'archive':
          messageContent = '📦 Archive File';
          break;
        case 'text':
          messageContent = '📄 Text Document';
          break;
        default:
          messageContent = `📎 ${attachment.file_name}`;
      }
      
      // Send message with attachment
      const message = await sendMessageApi(Number(conversationId), { 
        content: messageContent,
        message_type: messageType,
        attachment_id: attachment.attachment_id
      });
      console.log('Message with attachment sent:', message);
      
      // Add message to UI
      const newMessage: UiMsg = {
        id: String(message.message_id),
        text: message.content || messageContent,
        sent: true,
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        created_at: message.created_at,
        attachment_url: attachment.file_url,
        message_type: messageType,
        attachment_info: {
          file_name: attachment.file_name,
          file_type: attachment.file_type,
          file_category: attachment.file_category as FileCategory,
          file_size: attachment.file_size,
        },
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
                      <View>
                        {console.log('Rendering attachment:', {
                          url: item.attachment_url,
                          category: item.attachment_info?.file_category,
                          type: item.attachment_info?.file_type,
                          name: item.attachment_info?.file_name
                        })}
                        {item.attachment_info?.file_category === 'image' || isImageFile(item.attachment_info?.file_category || 'document', item.attachment_info?.file_type) ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                              onPress={() => {
                                if (item.attachment_url) {
                                  // Show image in modal for viewing
                                  setViewingImageUrl(item.attachment_url);
                                  setShowImageModal(true);
                                }
                              }}
                          >
                            <Image 
                              source={{ uri: item.attachment_url }} 
                              style={styles.attachmentImage}
                              resizeMode="cover"
                              onError={(error) => {
                                console.log('Image load error:', error);
                              }}
                              onLoad={() => {
                                console.log('Image loaded successfully:', item.attachment_url);
                              }}
                            />
                            {item.attachment_info?.file_name && (
                              <Text style={[styles.attachmentFileName, isActuallyMine ? styles.attachmentFileNameSent : styles.attachmentFileNameReceived]}>
                                {item.attachment_info.file_name}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ) : item.attachment_info?.file_category === 'video' || isVideoFile(item.attachment_info?.file_category || 'document', item.attachment_info?.file_type) ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                              onPress={async () => {
                                if (item.attachment_url) {
                                  try {
                                    // Convert media URL to ngrok bypass URL
                                    console.log('Original video URL:', item.attachment_url);
                                    const bypassUrl = item.attachment_url.replace(/\/media\//, '/api/messaging/files/');
                                    console.log('Video URL conversion:', { original: item.attachment_url, bypass: bypassUrl });
                                    console.log('URL replacement worked:', bypassUrl !== item.attachment_url);
                                    // Use FileSystem.downloadAsync approach
                                    try {
                                      // Create a temporary file URL
                                      const fileName = `video_${Date.now()}.mp4`;
                                      const fileUri = FileSystem.documentDirectory + fileName;
                                      
                                      // Download the file directly
                                      const downloadResult = await FileSystem.downloadAsync(bypassUrl, fileUri, {
                                        headers: {
                                          'ngrok-skip-browser-warning': 'true',
                                          'User-Agent': 'MobileApp/1.0'
                                        }
                                      });
                                      
                                      if (downloadResult.status === 200) {
                                        // Share the file
                                        const isAvailable = await Sharing.isAvailableAsync();
                                        if (isAvailable) {
                                          await Sharing.shareAsync(downloadResult.uri);
                                        } else {
                                          Alert.alert('Success', 'Video downloaded successfully!');
                                        }
                                      } else {
                                        throw new Error(`Download failed: ${downloadResult.status}`);
                                      }
                                    } catch (error) {
                                      console.error('Video download error:', error);
                                      // Fallback to direct linking
                                      await Linking.openURL(bypassUrl);
                                    }
                                  } catch (error) {
                                    console.error('Video open error:', error);
                                    Alert.alert('Error', 'Could not open video');
                                  }
                                }
                              }}
                            style={styles.videoContainer}
                          >
                            <View style={styles.videoThumbnail}>
                              <FontAwesome name="play-circle" size={40} color="rgba(255, 255, 255, 0.8)" />
                              <Text style={styles.videoPlayText}>Tap to play video</Text>
                            </View>
                            {item.attachment_info?.file_name && (
                              <Text style={[styles.attachmentFileName, isActuallyMine ? styles.attachmentFileNameSent : styles.attachmentFileNameReceived]}>
                                {item.attachment_info.file_name}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ) : item.attachment_info?.file_category === 'audio' || isAudioFile(item.attachment_info?.file_category || 'document', item.attachment_info?.file_type) ? (
                          <View>
                            <TouchableOpacity style={styles.audioAttachment}>
                              <FontAwesome name="play-circle" size={30} color={isActuallyMine ? '#1C4E80' : '#666'} />
                              <Text style={[styles.audioAttachmentText, isActuallyMine ? styles.audioAttachmentTextSent : styles.audioAttachmentTextReceived]}>
                                Audio File
                              </Text>
                            </TouchableOpacity>
                            {item.attachment_info?.file_name && (
                              <Text style={[styles.attachmentFileName, isActuallyMine ? styles.attachmentFileNameSent : styles.attachmentFileNameReceived]}>
                                {item.attachment_info.file_name}
                              </Text>
                            )}
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                              const url = item.attachment_url;
                              const fileName = item.attachment_info?.file_name || item.text;
                              const fileType = item.attachment_info?.file_type || '';
                              if (!url) return;
                              
                              // Show download confirmation for documents
                              setDownloadFile({ url, name: fileName, type: fileType });
                              setShowDownloadModal(true);
                            }}
                            style={[styles.fileAttachment, isActuallyMine ? styles.fileAttachmentSent : styles.fileAttachmentReceived]}
                          >
                            <Text style={[styles.fileIcon, isActuallyMine ? styles.fileIconSent : styles.fileIconReceived]}>
                              {getFileIcon(item.attachment_info?.file_category || 'document', item.attachment_info?.file_type)}
                            </Text>
                            <View style={styles.fileInfo}>
                              <Text style={[styles.fileName, isActuallyMine ? styles.fileNameSent : styles.fileNameReceived]} numberOfLines={1}>
                                {item.attachment_info?.file_name || item.text}
                              </Text>
                              {item.attachment_info?.file_size && (
                                <Text style={[styles.fileSize, isActuallyMine ? styles.fileSizeSent : styles.fileSizeReceived]}>
                                  {formatFileSize(item.attachment_info.file_size)}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
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
      
      {/* Download Confirmation Modal */}
      <Modal
        visible={showDownloadModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDownloadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Download File</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to download "{downloadFile?.name}"?
            </Text>
            <Text style={styles.modalFileType}>
              File type: {downloadFile?.type || 'Unknown'}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowDownloadModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={async () => {
                  if (downloadFile) {
                    try {
                      // Convert media URL to ngrok bypass URL
                      console.log('Original file URL:', downloadFile.url);
                      const bypassUrl = downloadFile.url.replace(/\/media\//, '/api/messaging/files/');
                      console.log('File URL conversion:', { original: downloadFile.url, bypass: bypassUrl });
                      console.log('URL replacement worked:', bypassUrl !== downloadFile.url);
                      // Use FileSystem.downloadAsync approach
                      try {
                        // Create a temporary file URL
                        const fileName = downloadFile.name || `file_${Date.now()}`;
                        const fileUri = FileSystem.documentDirectory + fileName;
                        
                        // Download the file directly
                        const downloadResult = await FileSystem.downloadAsync(bypassUrl, fileUri, {
                          headers: {
                            'ngrok-skip-browser-warning': 'true',
                            'User-Agent': 'MobileApp/1.0'
                          }
                        });
                        
                        if (downloadResult.status === 200) {
                          // Share the file
                          const isAvailable = await Sharing.isAvailableAsync();
                          if (isAvailable) {
                            await Sharing.shareAsync(downloadResult.uri);
                            Alert.alert('Success', 'File downloaded and shared successfully!');
                          } else {
                            Alert.alert('Success', 'File downloaded successfully!');
                          }
                        } else {
                          throw new Error(`Download failed: ${downloadResult.status}`);
                        }
                      } catch (error) {
                        console.error('File download error:', error);
                        // Fallback to direct linking
                        await Linking.openURL(bypassUrl);
                        Alert.alert('Success', 'File opened successfully!');
                      }
                    } catch (error) {
                      console.error('File open error:', error);
                      Alert.alert('Error', 'Could not open file');
                    }
                  }
                  setShowDownloadModal(false);
                  setDownloadFile(null);
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewing Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalCloseArea}
            activeOpacity={1}
            onPress={() => setShowImageModal(false)}
          >
            <View style={styles.imageModalContent}>
              <TouchableOpacity 
                style={styles.imageModalCloseButton}
                onPress={() => setShowImageModal(false)}
              >
                <Text style={styles.imageModalCloseText}>✕</Text>
              </TouchableOpacity>
              {viewingImageUrl && (
                <Image 
                  source={{ uri: viewingImageUrl }} 
                  style={styles.imageModalImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

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
  attachmentFileName: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  attachmentFileNameSent: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  attachmentFileNameReceived: {
    color: '#666',
  },
  videoContainer: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  videoThumbnail: {
    width: 280,
    height: 160,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  videoPlayText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  audioAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginVertical: 4,
    minWidth: 200,
  },
  audioAttachmentText: {
    fontSize: 14,
    marginLeft: 8,
  },
  audioAttachmentTextSent: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  audioAttachmentTextReceived: {
    color: '#666',
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 4,
    minWidth: 200,
    maxWidth: 300,
    borderWidth: 1,
  },
  fileAttachmentSent: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  fileAttachmentReceived: {
    backgroundColor: '#f1f3f4',
    borderColor: '#dde3ea',
  },
  fileIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  fileIconSent: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fileIconReceived: {
    color: '#1a1a1a',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileNameSent: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fileNameReceived: {
    color: '#1a1a1a',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  fileSizeSent: {
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  fileSizeReceived: {
    color: '#555',
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
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalFileType: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#1e3a8a',
  },
  modalButtonSecondary: {
    backgroundColor: '#f1f3f4',
    borderWidth: 1,
    borderColor: '#dde3ea',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: 'white',
  },
  modalButtonTextSecondary: {
    color: '#1a1a1a',
  },
  
  // Image Modal Styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
});

export default ChatMessageScreen;
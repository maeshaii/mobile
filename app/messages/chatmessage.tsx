import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, FlatList, Platform, AppState, Alert, Keyboard, Dimensions, StatusBar, Modal, Linking, ScrollView, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Using expo-av for video playback (more stable)
import { Video, ResizeMode } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

import { listMessages, markConversationRead, sendMessage as sendMessageApi, getWebSocketBase, getUserInfo, uploadAttachment, updateMessageApi, deleteMessageApi, deleteConversation, api, MessageItem, getAccessToken, getRefreshToken, API_BASE_URL, getAdminPesoUsers, createConversation, getOnlineUsers } from '../../services/api';
import EmojiPickerModal from '../../components/EmojiPickerModal';
import { downloadImage, downloadVideo, downloadDocument } from '../../utils/downloadHelper';
import { ConversationWebSocket, TypingIndicator, WsEvent } from '../../services/websocketHelper';
import { getFileIcon, getFileTypeDisplayName, formatFileSize, isImageFile, isVideoFile, isAudioFile, FileCategory } from '../../utils/fileUtils';
import { deduplicateMessages, addMessageWithDeduplication, replaceTempMessage, removeTempMessage, isDuplicateMessage } from '../../utils/messageUtils';
import { sanitizeUserInput, validateMessageType } from '../../utils/securityUtils';
import { useLogger } from '../../utils/logger';
import { renderTextWithLinks } from '../../utils/linkRenderer';

// Import new P0 components
import MessageActions from '../../components/MessageActions';
import { MessageReactionPicker } from '../../components/MessageReactionPicker';
import MessageEditModal from '../../components/MessageEditModal';
import ReplyPreview from '../../components/ReplyPreview';
import ErrorBoundary from '../../components/ErrorBoundary';
import { profilePicCache } from '../../services/profilePicCache';

const samplePic = require('../../assets/images/sample_pic.jpg');
const ctuLogo = require('../../assets/images/ctu_logo.png');

/** Normalize attachment URLs to https and ensure they are absolute */
const buildAttachmentUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  
  // Force https for ngrok (ATS on iOS) and prepend API base for relative paths
  const absolute = trimmed.startsWith('http')
    ? trimmed.replace(/^http:\/\//i, 'https://')
    : `${API_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  return absolute;
};

/** Use the streaming-friendly API route (adds range support and bypass headers server-side) */
const buildStreamingUrl = (url?: string | null): string | null => {
  const absolute = buildAttachmentUrl(url);
  if (!absolute) return null;
  return absolute.includes('/media/')
    ? absolute.replace('/media/', '/api/messaging/files/')
    : absolute;
};

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
  reactions?: Array<{ emoji: string; userId: number; userName?: string }>;
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
  is_edited?: boolean;
  is_read?: boolean;
};

const ChatMessageScreen = () => {
  const logger = useLogger('ChatMessageScreen');
  const insets = useSafeAreaInsets();
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
  const [otherParticipantAvatar, setOtherParticipantAvatar] = useState<string | null>(null);
  const [otherParticipantId, setOtherParticipantId] = useState<number | null>(null);
  const [isParticipantOnline, setIsParticipantOnline] = useState(false);
  
  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFile, setDownloadFile] = useState<{url: string; name: string; mimeType: string} | null>(null);
  const [isSharing, setIsSharing] = useState(false); // Prevent multiple concurrent downloads
  
  // Image viewing state
  const [showImageModal, setShowImageModal] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  
  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Video player state
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState<Set<string>>(new Set());
  
  // Typing indicators state
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  // P0 Features: Message Actions, Reactions, Reply, Edit, Delete
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<UiMsg | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionMessage, setReactionMessage] = useState<UiMsg | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<UiMsg | null>(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<UiMsg | null>(null);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<ConversationWebSocket | null>(null);
  const typingIndicatorRef = useRef<TypingIndicator | null>(null);
  const hasMarkedAsRead = useRef(false);
  const typingTimeoutRef = useRef<any>(null);
  const typingTimeoutsRef = useRef<Record<number, NodeJS.Timeout>>({});
  const inputRef = useRef<TextInput>(null);
  const isResolvingConversation = useRef(false);

  // Emoji picker functionality
  const handleEmojiSelect = (emoji: string) => {
    try {
      // Validate emoji before adding
      if (emoji && typeof emoji === 'string' && emoji.length > 0) {
        setInput(prev => prev + emoji);
        // DON'T close picker - let user select multiple emojis
        // User can close by tapping outside or the close button
      } else {
        console.warn('Invalid emoji selected:', emoji);
      }
    } catch (error) {
      console.error('Error handling emoji selection:', error);
    }
  };

  // Load current user and conversation details
  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getUserInfo();
        setCurrentUser(user);
        console.log('Loaded current user:', user);
        
        // Fetch conversation details to get other participant's avatar
        if (conversationId) {
          try {
            const response = await api.get(`/api/messaging/conversations/${conversationId}/`);
            const conversation = response.data;
            console.log('Loaded conversation:', conversation);
            
            // Get other participant's info
            const otherParticipant = conversation.other_participant;
            if (otherParticipant) {
              if (otherParticipant.avatar_url) {
                setOtherParticipantAvatar(otherParticipant.avatar_url);
                console.log('Loaded other participant avatar:', otherParticipant.avatar_url);
              }
              if (otherParticipant.user_id) {
                setOtherParticipantId(otherParticipant.user_id);
                console.log('Loaded other participant ID:', otherParticipant.user_id);
              }
            }
          } catch (convError) {
            console.error('Failed to load conversation details:', convError);
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    }
    loadUser();
  }, [conversationId]);

  // Handle missing conversationId when name is provided (for CCICT/PESO messaging)
  useEffect(() => {
    async function resolveConversation() {
      // Only proceed if conversationId is missing but name is provided
      if (conversationId || !name || !currentUser?.id || isResolvingConversation.current) {
        return;
      }

      // Mark as resolving to prevent multiple attempts
      isResolvingConversation.current = true;

      try {
        console.log('Resolving conversation for name:', name);
        const normalizedName = name.toUpperCase().trim();
        
        // Check if it's CCICT or PESO
        if (normalizedName === 'CCICT' || normalizedName === 'PESO') {
          console.log('Detected admin/peso messaging request:', normalizedName);
          
          // Get admin/peso user IDs
          const adminPesoData = await getAdminPesoUsers();
          const adminUserIds = adminPesoData.admin_user_ids || [];
          const pesoUserIds = adminPesoData.peso_user_ids || [];
          
          console.log('Admin user IDs:', adminUserIds);
          console.log('Peso user IDs:', pesoUserIds);
          
          // Determine which user ID to use
          let targetUserId: number | null = null;
          if (normalizedName === 'CCICT' && adminUserIds.length > 0) {
            targetUserId = adminUserIds[0];
            console.log('Using admin user ID for CCICT:', targetUserId);
          } else if (normalizedName === 'PESO' && pesoUserIds.length > 0) {
            targetUserId = pesoUserIds[0];
            console.log('Using peso user ID for PESO:', targetUserId);
          }
          
          if (!targetUserId) {
            console.error('No user ID found for', normalizedName);
            Alert.alert('Error', `Unable to find ${normalizedName} user. Please try again later.`);
            router.back();
            return;
          }
          
          // Create or get existing conversation
          console.log('Creating conversation with user ID:', targetUserId);
          const conversation = await createConversation(targetUserId);
          const newConversationId = conversation.conversation_id || conversation.id;
          
          if (!newConversationId) {
            console.error('No conversation ID returned from createConversation');
            Alert.alert('Error', 'Failed to create conversation. Please try again.');
            router.back();
            return;
          }
          
          console.log('Conversation created/found with ID:', newConversationId);
          
          // Update route with the conversationId
          router.replace({
            pathname: '/messages/chatmessage',
            params: { 
              conversationId: String(newConversationId),
              name: name 
            }
          });
        } else {
          // For other users, we'd need to search by name, but that's more complex
          // For now, show an error
          console.warn('Name provided but not CCICT or PESO:', name);
          Alert.alert('Error', 'Unable to start conversation. Please use the search feature to find the user.');
          router.back();
        }
      } catch (error) {
        console.error('Failed to resolve conversation:', error);
        Alert.alert('Error', 'Failed to start conversation. Please try again.');
        router.back();
      } finally {
        // Reset the flag after a delay to allow navigation to complete
        setTimeout(() => {
          isResolvingConversation.current = false;
        }, 1000);
      }
    }

    resolveConversation();
  }, [conversationId, name, currentUser?.id, router]);

  // Track whether the other participant is currently online via the shared API (like web version)
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const updateParticipantStatus = async () => {
      if (!otherParticipantId) {
        setIsParticipantOnline(false);
        return;
      }

      try {
        const response = await getOnlineUsers();
        if (!isMounted) return;
        if (!response?.success) {
          setIsParticipantOnline(false);
          return;
        }

        const onlineIds = new Set<number>(
          (Array.isArray(response.online_users) ? response.online_users : []).map((user: any) =>
            Number(user.user_id)
          )
        );
        setIsParticipantOnline(onlineIds.has(Number(otherParticipantId)));
      } catch (error) {
        console.error('Failed to determine participant online status:', error);
        if (isMounted) {
          setIsParticipantOnline(false);
        }
      }
    };

    if (otherParticipantId) {
      updateParticipantStatus();
      intervalId = setInterval(updateParticipantStatus, 30000); // Poll every 30 seconds like web
    } else {
      setIsParticipantOnline(false);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [otherParticipantId]);

  // Keyboard event listeners for manual handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates.height;
        const screenY = e.endCoordinates.screenY;
        const windowHeight = Dimensions.get('window').height;
        // Calculate distance from bottom more accurately
        const distanceFromBottom = windowHeight - screenY;
        const calculatedHeight = Math.max(height, distanceFromBottom);
        console.log('🎹 Keyboard showing, height:', height, 'screenY:', screenY, 'distanceFromBottom:', distanceFromBottom);
        setKeyboardHeight(calculatedHeight);
        setIsKeyboardVisible(true);
        
        // Close emoji picker when keyboard shows (user tapped text input)
        setShowEmojiPicker(false);
        
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          console.log('Scrolling to bottom due to keyboard');
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
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
      // SUPER aggressive scrolling - multiple attempts over longer period
      const scrollToBottom = () => flatListRef.current?.scrollToEnd({ animated: false });
      
      scrollToBottom(); // Immediate
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 200);
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
      setTimeout(scrollToBottom, 800);
      setTimeout(scrollToBottom, 1000);
    }
  }, [messages.length]);

  // Force scroll to bottom when conversation opens
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const scrollToBottom = () => flatListRef.current?.scrollToEnd({ animated: false });
      
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
      setTimeout(scrollToBottom, 800);
      setTimeout(scrollToBottom, 1000);
      setTimeout(scrollToBottom, 1500);
      setTimeout(scrollToBottom, 2000);
    }
  }, [conversationId]);
  
  // Also scroll when loading completes
  useEffect(() => {
    if (!loading && messages.length > 0) {
      const scrollToBottom = () => flatListRef.current?.scrollToEnd({ animated: false });
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
    }
  }, [loading, messages.length]);

  // Function to load messages (can be called from auto-refresh)
  const loadMessages = async () => {
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
          } : undefined,
          // P0 Features: Include reactions, reply_to, and edited status
          reactions: m.reactions || [],
          reply_to: m.reply_to ? {
            message_id: String(m.reply_to.message_id),
            content: m.reply_to.content,
            sender_name: m.reply_to.sender_name
          } : undefined,
          is_edited: m.is_edited || false,
          is_read: m.is_read || false
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
      }, 300);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh messages every 30 seconds to ensure real-time sync
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (conversationId && currentUser?.id) {
        console.log('Auto-refreshing messages...');
        loadMessages();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [conversationId, currentUser?.id]);

  useEffect(() => {
    // Load initial messages - only when we have both conversationId and currentUser
    if (conversationId && currentUser?.id) {
      loadMessages();
    }
  }, [conversationId, currentUser?.id]);

  useEffect(() => {
    // Connect WebSocket - only when we have both conversationId and currentUser
    if (!conversationId || !currentUser || !currentUser.id) {
      console.log('Skipping WebSocket connection - missing data:', { conversationId, currentUser: !!currentUser, userId: currentUser?.id });
      return;
    }

    // Check if already connected
    if (wsRef.current) {
      console.log('⏭️ [WebSocket] Already connected, skipping reconnection');
      return;
    }

    const connectWebSocket = async () => {
      try {
        console.log('🔌 [WebSocket] Connecting for conversation:', conversationId, 'user:', currentUser.id);
        const wsBaseUrl = await getWebSocketBase();
        console.log('🔌 [WebSocket] Base URL:', wsBaseUrl);
        
        // Get JWT token for WebSocket authentication
        const token = await getAccessToken();
        console.log('🔌 [WebSocket] Token available:', !!token);
        
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
        console.log('WebSocket base URL:', wsBaseUrl);
        console.log('Creating WebSocket with token:', !!validToken);
        const ws = new ConversationWebSocket(Number(conversationId), wsBaseUrl, validToken || undefined);
        wsRef.current = ws;
    
    const typingIndicator = new TypingIndicator(ws);
    typingIndicatorRef.current = typingIndicator;

    // Create callback functions that can be properly cleaned up
    const statusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
      console.log('🔌 [WebSocket] Status changed:', status);
      setConnectionStatus(status);
      if (status === 'connected') {
        console.log('✅ [WebSocket] Connected successfully - Real-time messaging is active!');
        // Mark conversation as read when connected
        if (!hasMarkedAsRead.current) {
          markConversationRead(Number(conversationId)).catch(() => {});
          hasMarkedAsRead.current = true;
        }
      } else if (status === 'error') {
        console.error('❌ [WebSocket] Connection error - Messages will not be real-time');
      } else if (status === 'disconnected') {
        console.warn('⚠️ [WebSocket] Disconnected - Messages will not be real-time');
      }
    };

    const messageCallback = (event: WsEvent) => {
      if (!currentUser || !currentUser.id) {
        console.log('Skipping WebSocket message - no currentUser');
        return;
      }
      
      const myId = currentUser.id;
      console.log('📨 [WebSocket] Message received:', event.type, 'myId:', myId);
      
      switch (event.type) {
        case 'message':
          // Skip WebSocket echo for own messages (like web)
          if (event.sender_id === myId) {
            console.log('⏭️ [WebSocket] Skipping own message echo');
            break;
          }
          console.log('📥 [WebSocket] NEW MESSAGE from other user! Real-time working!');
          
          // Validate message data before processing
          if (!event.message_id || !event.sender_id || !event.sender_name) {
            console.warn('Invalid message data received:', event);
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
              text: event.content || '',
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
          // Filter out current user - don't show typing indicator for yourself
          if (event.user_id && event.user_id === myId) {
            // Ignore typing events from current user
            break;
          }
          
          // Handle typing indicators based on is_typing flag
          if (event.user_id && event.user_id !== myId) {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              // Check is_typing flag to add or remove user
              if (event.is_typing) {
                // User started typing - add to set
                newSet.add(event.user_id);
              } else {
                // User stopped typing - remove from set
                newSet.delete(event.user_id);
              }
              return newSet;
            });
            
            // Also set a timeout to clear typing indicator after 3 seconds as a safety measure
            // (in case stop_typing event is missed)
            if (event.is_typing) {
              // Clear any existing timeout for this user
              if (typingTimeoutsRef.current[event.user_id]) {
                clearTimeout(typingTimeoutsRef.current[event.user_id]);
              }
              
              // Set new timeout to clear typing indicator after 3 seconds
              typingTimeoutsRef.current[event.user_id] = setTimeout(() => {
                setTypingUsers(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(event.user_id);
                  return newSet;
                });
                delete typingTimeoutsRef.current[event.user_id];
              }, 3000);
            } else {
              // Clear timeout if user stopped typing
              if (typingTimeoutsRef.current[event.user_id]) {
                clearTimeout(typingTimeoutsRef.current[event.user_id]);
                delete typingTimeoutsRef.current[event.user_id];
              }
            }
          }
          break;
        
        // P0 Feature: Real-time Reaction Updates
        case 'reaction':
          console.log('[Reaction] WebSocket event received:', event);
          if (event.message_id) {
            setMessages(prev => prev.map(m => {
              if (m.id === String(event.message_id)) {
                const reactions = m.reactions || [];
                if (event.action === 'add' && event.emoji && event.user_id) {
                  // Add reaction only if not already present (prevent duplicates)
                  const alreadyExists = reactions.find(
                    r => r.emoji === event.emoji && r.userId === event.user_id
                  );
                  if (!alreadyExists) {
                    console.log(`[Reaction] Adding ${event.emoji} from user ${event.user_id} to message ${event.message_id}`);
                    return {
                      ...m,
                      reactions: [...reactions, {
                        emoji: event.emoji,
                        userId: event.user_id,
                        userName: event.user_name || 'Unknown'
                      }]
                    };
                  }
                } else if (event.action === 'remove' && event.emoji && event.user_id) {
                  // Remove reaction
                  console.log(`[Reaction] Removing ${event.emoji} from user ${event.user_id} on message ${event.message_id}`);
                  return {
                    ...m,
                    reactions: reactions.filter(r =>
                      !(r.emoji === event.emoji && r.userId === event.user_id)
                    )
                  };
                }
              }
              return m;
            }));
          }
          break;
        
        // P0 Feature: Real-time Message Edit Updates
        case 'edit':
          console.log('WebSocket edit event:', event);
          if (event.message_id && event.content) {
            setMessages(prev => prev.map(m => {
              if (m.id === String(event.message_id)) {
                return {
                  ...m,
                  text: event.content,
                  is_edited: true
                };
              }
              return m;
            }));
          }
          break;
        
        // P0 Feature: Real-time Message Delete Updates
        case 'delete':
          console.log('WebSocket delete event:', event);
          if (event.message_id) {
            setMessages(prev => prev.filter(m => m.id !== String(event.message_id)));
          }
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
      // Clean up WebSocket connection
      console.log('🔌 [WebSocket] Cleaning up connection');
      
      // Clear all typing timeouts
      Object.values(typingTimeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      typingTimeoutsRef.current = {};
      
      // Clear typing users when conversation changes
      setTypingUsers(new Set());
      
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [conversationId, currentUser?.id]); // Only reconnect if conversation or userId changes

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
      // Check for empty input before sanitization
      const trimmedInput = input.trim();
      if (!trimmedInput || !currentUser || !currentUser.id) {
        return; // Silently return if input is empty
      }
      
      // Sanitize input on client side as first line of defense
      const sanitizedText = sanitizeUserInput(trimmedInput);
      if (!sanitizedText) return;
    
      console.log('Sending message:', sanitizedText, 'user:', currentUser.id, 'replyingTo:', replyingToMessage?.id);
      
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const tempMessage: UiMsg = {
        id: tempId,
        text: sanitizedText,
        sent: true,
        tempId,
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        created_at: new Date().toISOString(),
        // Include reply info if replying
        reply_to: replyingToMessage ? {
          message_id: replyingToMessage.id,
          content: replyingToMessage.text,
          sender_name: replyingToMessage.sender_name || 'Unknown'
        } : undefined
      };
    
    // Add temporary message immediately (optimistic UI)
    setMessages(prev => addMessageWithDeduplication(prev, tempMessage));
    setInput('');
    
    // Clear reply state
    const replyToId = replyingToMessage?.id;
    setReplyingToMessage(null);
    
    // Clear any existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
      try {
        // Build request payload with optional reply_to_message_id
        const payload: any = { content: sanitizedText };
        if (replyToId) {
          payload.reply_to_message_id = parseInt(replyToId);
        }
        
        const saved = await sendMessageApi(Number(conversationId), payload);
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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
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

  // P0 Feature: Long Press Handler - Show Message Actions
  const handleMessageLongPress = useCallback((message: UiMsg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setShowMessageActions(true);
  }, []);

  // P0 Feature: Message Reaction Handler (Client-Side Only - Like Web Version)
  const handleReaction = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReactionMessage(message);
      setShowReactionPicker(true);
    }
  }, [messages]);

  const handleSelectReaction = useCallback(async (emoji: string) => {
    if (!reactionMessage || !currentUser) return;
    
    try {
      // Check if user already reacted with this specific emoji
      const existingSameReaction = reactionMessage.reactions?.find(
        r => r.emoji === emoji && r.userId === currentUser.id
      );
      
      // Check if user already reacted with ANY emoji (to enforce 1 reaction limit)
      const existingAnyReaction = reactionMessage.reactions?.find(
        r => r.userId === currentUser.id
      );
      
      // If user clicked the same emoji they already have, remove it (toggle off)
      if (existingSameReaction) {
        // Remove reaction
        if (wsRef.current) {
          wsRef.current.send({
            type: 'reaction',
            message_id: parseInt(reactionMessage.id),
            emoji: emoji,
            action: 'remove'
          });
          console.log(`[Reaction] Sent via WebSocket: remove ${emoji} on message ${reactionMessage.id}`);
        }
        
        // Optimistic UI update - remove reaction
        setMessages(prev => prev.map(m => {
          if (m.id === reactionMessage.id) {
            return {
              ...m,
              reactions: m.reactions?.filter(r => !(r.emoji === emoji && r.userId === currentUser.id))
            };
          }
          return m;
        }));
      } else {
        // User wants to add/change reaction
        // If user already has a different reaction, remove it first
        if (existingAnyReaction && existingAnyReaction.emoji !== emoji) {
          // Remove old reaction first
          if (wsRef.current) {
            wsRef.current.send({
              type: 'reaction',
              message_id: parseInt(reactionMessage.id),
              emoji: existingAnyReaction.emoji,
              action: 'remove'
            });
            console.log(`[Reaction] Removing old reaction ${existingAnyReaction.emoji} before adding ${emoji}`);
          }
        }
        
        // Add new reaction
        if (wsRef.current) {
          wsRef.current.send({
            type: 'reaction',
            message_id: parseInt(reactionMessage.id),
            emoji: emoji,
            action: 'add'
          });
          console.log(`[Reaction] Sent via WebSocket: add ${emoji} on message ${reactionMessage.id}`);
        }
        
        // Optimistic UI update - replace existing reaction or add new one
        setMessages(prev => prev.map(m => {
          if (m.id === reactionMessage.id) {
            // Remove any existing reaction from this user, then add the new one
            const filteredReactions = (m.reactions || []).filter(r => r.userId !== currentUser.id);
            return {
              ...m,
              reactions: [...filteredReactions, { emoji, userId: currentUser.id, userName: currentUser.name }]
            };
          }
          return m;
        }));
      }
      
      setShowReactionPicker(false);
      setReactionMessage(null);
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      setShowReactionPicker(false);
      setReactionMessage(null);
    }
  }, [reactionMessage, currentUser, messages]);

  // P0 Feature: Message Reply Handler
  const handleReply = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReplyingToMessage(message);
      setShowMessageActions(false);
    }
  }, [messages]);

  const cancelReply = useCallback(() => {
    setReplyingToMessage(null);
  }, []);

  // P0 Feature: Message Edit Handler
  const handleEdit = useCallback((messageId: string, currentContent: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setEditingMessage(message);
      setEditMessageContent(currentContent);
      setShowEditModal(true);
      setShowMessageActions(false);
    }
  }, [messages]);

  const handleSaveEdit = useCallback(async (messageId: string, newContent: string) => {
    if (!conversationId) return;
    
    setIsSavingEdit(true);
    setEditError(null);
    
    try {
      const sanitizedContent = sanitizeUserInput(newContent.trim());
      if (!sanitizedContent) {
        setEditError('Message cannot be empty.');
        setIsSavingEdit(false);
        return;
      }
      
      // Call API to update message using the proper helper function
      console.log('Updating message:', messageId, 'with content:', sanitizedContent);
      await updateMessageApi(Number(conversationId), parseInt(messageId), sanitizedContent);
      
      // Update local state
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            text: sanitizedContent,
            is_edited: true
          };
        }
        return m;
      }));
      
      setShowEditModal(false);
      setEditingMessage(null);
      setEditMessageContent('');
      setIsSavingEdit(false);
      
      Alert.alert('Success', 'Message updated successfully!');
    } catch (error) {
      console.error('Failed to edit message:', error);
      setEditError('Failed to update message. Please try again.');
      setIsSavingEdit(false);
    }
  }, [conversationId]);

  // P0 Feature: Message Delete Handler
  const handleDelete = useCallback(async (messageId: string) => {
    if (!conversationId) return;
    
    console.log('Delete handler called for message:', messageId);
    
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting message:', messageId, 'from conversation:', conversationId);
              await deleteMessageApi(Number(conversationId), parseInt(messageId));
              
              // Remove message from local state
              setMessages(prev => prev.filter(m => m.id !== messageId));
              
              setShowMessageActions(false);
              setSelectedMessage(null);
              
              Alert.alert('Success', 'Message deleted successfully!');
            } catch (error) {
              console.error('Failed to delete message:', error);
              Alert.alert('Error', 'Failed to delete message. Please try again.');
            }
          }
        }
      ]
    );
  }, [conversationId]);

  // Delete Conversation Handler
  const handleDeleteConversation = useCallback(async () => {
    if (!conversationId) return;
    
    console.log('🔵 [MOBILE DELETE] START - Deleting conversation from chat screen:', {
      conversation_id: conversationId,
      other_user_name: name
    });
    
    setIsDeletingConversation(true);
    try {
      console.log('🔵 [MOBILE DELETE] Calling deleteConversation API...');
      const response = await deleteConversation(Number(conversationId));
      
      console.log('🔵 [MOBILE DELETE] API Response:', {
        status: response?.status,
        message: response?.message,
        conversation_id: response?.conversation_id,
        fully_deleted: response?.fully_deleted
      });
      
      const fullyDeleted = response?.fully_deleted === true;
      console.log('🔵 [MOBILE DELETE] Deletion decision:', {
        fully_deleted: fullyDeleted,
        should_navigate_away: true // Always navigate away for deleting user
      });
      
      setShowDeleteConfirmation(false);
      setShowConversationMenu(false);
      
      // Use replace instead of back for cleaner navigation
      // Always navigate away since the user deleted it (even if it still exists for others)
      router.replace('/messages/message');
      
      // Show success message
      setTimeout(() => {
        Alert.alert('Success', 'Conversation deleted successfully!');
      }, 300);
      
      console.log('🔵 [MOBILE DELETE] END - Deletion complete, navigated away');
    } catch (error) {
      console.error('🔵 [MOBILE DELETE] ERROR - Failed to delete conversation:', error);
      Alert.alert('Error', 'Failed to delete conversation. Please try again.');
    } finally {
      setIsDeletingConversation(false);
    }
  }, [conversationId, router, name]);

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
          message_type: m.message_type,
          attachment_info: m.attachments?.[0] ? {
            file_name: m.attachments[0].file_name,
            file_type: m.attachments[0].file_type,
            file_category: m.attachments[0].file_category,
            file_size: m.attachments[0].file_size
          } : undefined,
          // P0 Features: Include reactions, reply_to, and edited status
          reactions: m.reactions || [],
          reply_to: m.reply_to ? {
            message_id: String(m.reply_to.message_id),
            content: m.reply_to.content,
            sender_name: m.reply_to.sender_name
          } : undefined,
          is_edited: m.is_edited || false,
          is_read: m.is_read || false
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
      let messageType: 'text' | 'image' | 'file' | 'system' = 'file';
      let messageContent = '📎 File';
      
      switch (attachment.file_category) {
        case 'image':
          messageType = 'image';
          messageContent = '📷 Image';
          break;
        case 'video':
          messageType = 'file'; // Backend only supports 'file' for videos
          messageContent = '🎥 Video File';
          break;
        case 'audio':
          messageType = 'file'; // Backend only supports 'file' for audio
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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
      
    } catch (error: any) {
      console.error('Attachment upload failed:', error);
      
      // Extract error message from response
      let errorMessage = 'Failed to upload attachment. Please try again.';
      if (error?.error || error?.message) {
        // Mobile fetch response error
        const errorData = typeof error.error === 'string' ? error.error : error.message;
        errorMessage = errorData || errorMessage;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Upload Failed', errorMessage);
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
    <ErrorBoundary type="messaging" onReset={() => {
      // Reload messages on error reset
      if (conversationId && currentUser?.id) {
        loadMessages();
      }
    }}>
      <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarTitle}>{name || 'Chat'}</Text>
          <Text style={[
            styles.topBarStatus,
            isParticipantOnline ? styles.topBarStatusOnline : styles.topBarStatusOffline
          ]}>
            {isParticipantOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity 
            onPress={() => setShowConversationMenu(!showConversationMenu)}
            style={{ padding: 4 }}
          >
            <FontAwesome name="ellipsis-v" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversation Menu Dropdown */}
      {showConversationMenu && (
        <Modal
          transparent={true}
          visible={showConversationMenu}
          animationType="fade"
          onRequestClose={() => setShowConversationMenu(false)}
        >
          <TouchableOpacity 
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-start',
              alignItems: 'flex-end',
              paddingTop: 60,
              paddingRight: 10
            }}
            activeOpacity={1}
            onPress={() => setShowConversationMenu(false)}
          >
            <View style={{
              backgroundColor: '#fff',
              borderRadius: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
              minWidth: 200
            }}>
              <TouchableOpacity
                onPress={() => {
                  setShowConversationMenu(false);
                  setShowDeleteConfirmation(true);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  gap: 8
                }}
              >
                <FontAwesome name="trash" size={16} color="#dc3545" />
                <Text style={{ color: '#dc3545', fontSize: 14, fontWeight: '500' }}>
                  Delete Conversation
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Main Chat Area - Manual keyboard handling */}
      <View style={styles.chatContainer}>
        {/* Messages Area - Dynamic height based on keyboard */}
        <View style={[
          styles.messagesArea,
          {
            marginBottom: (isKeyboardVisible || showEmojiPicker) ? 
              (keyboardHeight > 0 ? keyboardHeight : (Platform.OS === 'ios' ? 290 : 270)) + 60 : 0
          }
        ]}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => {
              // Auto-scroll when content size changes
              console.log('FlatList content size changed, scrolling to bottom');
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
            onLayout={() => {
              // Auto-scroll when layout changes  
              console.log('FlatList layout changed, scrolling to bottom');
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 50);
            }}
            renderItem={({ item }) => {
              if (!currentUser) {
                console.log('No currentUser, skipping message render');
                return null;
              }
              
              const myId = currentUser.id;
              const isActuallyMine = item.sent || item.sender_id === myId;
              const attachmentUrl = buildAttachmentUrl(item.attachment_url);
              const streamingUrl = buildStreamingUrl(item.attachment_url);
              const videoSourceUrl = streamingUrl || attachmentUrl;
              
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
                  <View style={styles.messageRow}>
                    {/* Avatar for received messages */}
                    {!isActuallyMine && (
                      <Image
                        source={otherParticipantAvatar ? { uri: otherParticipantAvatar } : ctuLogo}
                        style={styles.messageAvatar}
                        defaultSource={ctuLogo}
                      />
                    )}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={() => handleMessageLongPress(item)}
                      style={[
                        styles.messageBubble,
                        isActuallyMine ? styles.bubbleSent : styles.bubbleReceived
                      ]}
                    >
                    {/* Sender label */}
                    <Text style={[
                      styles.senderLabel,
                      isActuallyMine ? styles.senderLabelSent : styles.senderLabelReceived
                    ]}>
                      {isActuallyMine ? 'You' : (item.sender_name || 'Unknown')}
                    </Text>
                    
                    {/* P0 Feature: Reply-To Preview */}
                    {item.reply_to && (
                      <View style={[
                        styles.replyPreviewContainer,
                        isActuallyMine ? styles.replyPreviewSent : styles.replyPreviewReceived
                      ]}>
                        <View style={styles.replyBar} />
                        <View style={styles.replyContent}>
                          <FontAwesome name="reply" size={12} color={isActuallyMine ? "rgba(255,255,255,0.7)" : "#666"} />
                          <View style={styles.replyTextContainer}>
                            <Text style={[
                              styles.replySenderName,
                              isActuallyMine ? styles.replySenderNameSent : styles.replySenderNameReceived
                            ]}>
                              {item.reply_to.sender_name}
                            </Text>
                            <Text 
                              style={[
                                styles.replyMessageText,
                                isActuallyMine ? styles.replyMessageTextSent : styles.replyMessageTextReceived
                              ]}
                              numberOfLines={1}
                            >
                              {item.reply_to.content || 'Attachment'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* Message content */}
                    {attachmentUrl ? (
                      <View>
                        {item.attachment_info?.file_category === 'image' || isImageFile(item.attachment_info?.file_category || 'document', item.attachment_info?.file_type) ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                              onPress={() => {
                                if (!attachmentUrl) return;
                                // Show image in modal for viewing
                                setViewingImageUrl(attachmentUrl);
                                setShowImageModal(true);
                              }}
                          >
                            <Image 
                              source={{ 
                                uri: attachmentUrl, 
                                headers: { 'ngrok-skip-browser-warning': 'true' }
                              }} 
                              style={styles.attachmentImage}
                              resizeMode="cover"
                              defaultSource={samplePic}
                              onError={(error) => {
                                console.log('Image load error:', error);
                              }}
                              onLoad={() => {
                                console.log('Image loaded successfully:', attachmentUrl);
                              }}
                            />
                            {item.attachment_info?.file_name && (
                              <Text style={[styles.attachmentFileName, isActuallyMine ? styles.attachmentFileNameSent : styles.attachmentFileNameReceived]}>
                                {item.attachment_info.file_name}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ) : item.attachment_info?.file_category === 'video' || isVideoFile(item.attachment_info?.file_category || 'document', item.attachment_info?.file_type) ? (
                          <View style={styles.videoContainer}>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => {
                                setPlayingVideoId(playingVideoId === item.id ? null : item.id);
                                if (playingVideoId !== item.id) {
                                  setVideoLoading(new Set([item.id]));
                                }
                              }}
                              style={styles.videoThumbnail}
                            >
                              {videoLoading.has(item.id) && playingVideoId === item.id && (
                                <View style={{ position: 'absolute', top: '50%', left: '50%', zIndex: 10, marginLeft: -20, marginTop: -20 }}>
                                  <ActivityIndicator size="large" color="#007bff" />
                                </View>
                              )}
                              <Video
                                source={{ 
                                  uri: videoSourceUrl || attachmentUrl || '',
                                  overrideFileExtensionAndroid: 'mp4',
                                  headers: {
                                    'ngrok-skip-browser-warning': 'true',
                                    'User-Agent': 'MobileApp/1.0'
                                  }
                                }}
                                style={styles.videoPlayer}
                                useNativeControls={true}
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay={playingVideoId === item.id}
                                positionMillis={0}
                                progressUpdateIntervalMillis={250}
                                volume={1.0}
                                onPlaybackStatusUpdate={(status: any) => {
                                  if (status.isLoaded && !status.isBuffering) {
                                    setVideoLoading(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(item.id);
                                      return newSet;
                                    });
                                  }
                                  if (status.didJustFinish) {
                                    setPlayingVideoId(null);
                                  }
                                }}
                                onError={(error: any) => {
                                  console.error('Video error:', { error, url: videoSourceUrl });
                                  setVideoLoading(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(item.id);
                                    return newSet;
                                  });
                                  setPlayingVideoId(null);
                                  
                                  // Extract error message
                                  const errorMessage = error?.message || error?.localizedDescription || 'Could not play video';
                                  
                                  // Show error with option to download
                                  Alert.alert(
                                    'Video Error',
                                    `${errorMessage}\n\nWould you like to download the video instead?`,
                                    [
                                      {
                                        text: 'Cancel',
                                        style: 'cancel',
                                      },
                                      {
                                        text: 'Download',
                                        onPress: () => {
                                          const downloadUrl = streamingUrl || attachmentUrl;
                                          if (downloadUrl) {
                                            downloadVideo(downloadUrl, item.attachment_info?.file_name || 'video');
                                          }
                                        },
                                      },
                                    ]
                                  );
                                }}
                                onLoad={(status) => {
                                  console.log('Video loaded successfully');
                                }}
                              />
                            </TouchableOpacity>
                            {item.attachment_info?.file_name && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Text style={[styles.attachmentFileName, isActuallyMine ? styles.attachmentFileNameSent : styles.attachmentFileNameReceived]} numberOfLines={1}>
                                  {item.attachment_info.file_name}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => {
                                    // Show confirmation FIRST
                                    Alert.alert(
                                      'Download Video',
                                      'Do you want to download this video to your device?',
                                      [
                                        {
                                          text: 'No',
                                          style: 'cancel'
                                        },
                                        {
                                          text: 'Yes',
                                          onPress: async () => {
                                            const downloadUrl = streamingUrl || attachmentUrl;
                                            if (downloadUrl && !isSharing) {
                                              try {
                                                setIsSharing(true);
                                                
                                                const filename = item.attachment_info?.file_name || `video_${Date.now()}.mp4`;
                                                
                                                // PROPER DOWNLOAD - saves to device Gallery
                                                await downloadVideo(
                                                  downloadUrl,
                                                  filename,
                                                  item.attachment_info?.file_type || 'video/mp4'
                                                );
                                              } catch (error) {
                                                console.error('Video download error:', error);
                                              } finally {
                                                setIsSharing(false);
                                              }
                                            }
                                          }
                                        }
                                      ]
                                    );
                                  }}
                                  style={{ padding: 4 }}
                                >
                                  <FontAwesome name="download" size={18} color={isActuallyMine ? 'rgba(255, 255, 255, 0.8)' : '#666'} />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
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
                              const url = attachmentUrl;
                              const fileName = item.attachment_info?.file_name || item.text;
                              const fileType = item.attachment_info?.file_type || 'application/octet-stream';
                              if (!url) return;
                              
                              // Show download confirmation for documents
                              setDownloadFile({ url, name: fileName, mimeType: fileType });
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
                            <Text style={styles.downloadIcon}>⬇️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <Text style={[
                        styles.messageText,
                        isActuallyMine ? styles.messageTextSent : styles.messageTextReceived
                      ]}>
                        {renderTextWithLinks(
                          item.text,
                          isActuallyMine ? styles.messageTextSent : styles.messageTextReceived,
                          { color: isActuallyMine ? '#ffffff' : '#007bff' }
                        )}
                      </Text>
                    )}
                    
                    {/* P0 Feature: Edited Indicator - Below message text */}
                    {item.is_edited && (
                      <Text style={[
                        styles.editedIndicator,
                        isActuallyMine ? styles.editedIndicatorSent : styles.editedIndicatorReceived
                      ]}>
                        (edited)
                      </Text>
                    )}
                    
                    {/* P0 Feature: Message Reactions Display */}
                    {item.reactions && item.reactions.length > 0 && (
                      <View style={styles.reactionsContainer}>
                        {item.reactions.map((reaction, index) => (
                          <View key={`${reaction.emoji}-${index}`} style={[
                            styles.reactionBubble,
                            reaction.userId === currentUser?.id && styles.reactionBubbleOwn
                          ]}>
                            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    {/* Timestamp and Status */}
                    <View style={[
                      styles.timestampContainer,
                      isActuallyMine ? styles.timestampContainerSent : styles.timestampContainerReceived
                    ]}>
                      <Text style={[
                        styles.timestamp,
                        isActuallyMine ? styles.timestampSent : styles.timestampReceived
                      ]}>
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : ''}
                      </Text>
                      {/* P0 Feature: Read Receipts */}
                      {isActuallyMine && (
                        <Text style={[
                          styles.messageStatus,
                          item.is_read && styles.messageStatusRead
                        ]}>
                          ✓✓
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.1}
            contentContainerStyle={{ 
              paddingBottom: 100,
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
          
          {/* Typing Indicator */}
          {(() => {
            // Filter out current user from typing users (safety check)
            const myId = currentUser?.id;
            const otherTypingUsers = Array.from(typingUsers).filter(userId => userId !== myId);
            
            if (otherTypingUsers.length === 0) {
              return null;
            }
            
            return (
              <View style={styles.typingIndicator}>
                <View style={styles.typingDots}>
                  <View style={[styles.typingDot, styles.typingDot1]} />
                  <View style={[styles.typingDot, styles.typingDot2]} />
                  <View style={[styles.typingDot, styles.typingDot3]} />
                </View>
                <Text style={styles.typingText}>
                  {otherTypingUsers.map(userId => {
                    // For now, just show "Someone" - you could enhance this to show actual names
                    return 'Someone';
                  }).join(', ')} typing...
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Input Bar - Fixed at bottom with keyboard offset */}
        <View style={[
          styles.inputBarContainer,
          {
            bottom: isKeyboardVisible && keyboardHeight > 0 
              ? keyboardHeight 
              : Math.max(insets.bottom, 8),
            zIndex: 1000
          }
        ]}>
          {/* P0 Feature: Reply Preview */}
          {replyingToMessage && (
            <ReplyPreview
              senderName={replyingToMessage.sender_name || 'Unknown'}
              messageContent={replyingToMessage.text}
              onCancel={cancelReply}
            />
          )}
          
          <View style={styles.inputBar}>
            <TouchableOpacity 
              onPress={handleAttachmentPress}
              style={styles.attachmentButton}
            >
              <FontAwesome name="paperclip" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                if (showEmojiPicker) {
                  // Close emoji picker and show keyboard
                  setShowEmojiPicker(false);
                  inputRef.current?.focus();
                } else {
                  // Close keyboard and show emoji picker
                  Keyboard.dismiss();
                  setShowEmojiPicker(true);
                }
              }}
              style={styles.emojiButton}
            >
              <FontAwesome name={showEmojiPicker ? "keyboard-o" : "smile-o"} size={20} color="white" />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
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
                  if (downloadFile && !isSharing) {
                    try {
                      setIsSharing(true);
                      // Convert media URL to ngrok bypass URL
                      console.log('Original file URL:', downloadFile.url);
                      const bypassUrl = downloadFile.url.replace(/\/media\//, '/api/messaging/files/');
                      console.log('File URL conversion:', { original: downloadFile.url, bypass: bypassUrl });

                      const fileName = downloadFile.name || `file_${Date.now()}`;

                      // PROPER DOWNLOAD - saves to device Downloads/Documents
                      await downloadDocument(bypassUrl, fileName, downloadFile.mimeType);
                    } catch (error) {
                      console.error('File download error:', error);
                    } finally {
                      setIsSharing(false);
                      setShowDownloadModal(false);
                      setDownloadFile(null);
                    }
                  }
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Emoji Picker - Positioned ABOVE input bar */}
      {showEmojiPicker && (
        <View style={{ 
          position: 'absolute', 
          bottom: 60, // Height of input bar (adjust if needed)
          left: 0, 
          right: 0,
          height: keyboardHeight > 0 ? keyboardHeight : (Platform.OS === 'ios' ? 290 : 270)
        }}>
          <EmojiPickerModal
            visible={showEmojiPicker}
            onClose={() => {
              setShowEmojiPicker(false);
              inputRef.current?.focus();
            }}
            onEmojiSelected={handleEmojiSelect}
            keyboardHeight={keyboardHeight > 0 ? keyboardHeight : (Platform.OS === 'ios' ? 290 : 270)}
          />
        </View>
      )}

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
                <>
                  <Image 
                    source={{ uri: viewingImageUrl }} 
                    style={styles.imageModalImage}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={styles.imageDownloadButton}
                    onPress={() => {
                      // Show confirmation FIRST
                      Alert.alert(
                        'Download Image',
                        'Do you want to download this image to your device?',
                        [
                          {
                            text: 'No',
                            style: 'cancel'
                          },
                          {
                            text: 'Yes',
                            onPress: async () => {
                              if (viewingImageUrl && !isSharing) {
                                try {
                                  setIsSharing(true);
                                  const filename = viewingImageUrl.substring(viewingImageUrl.lastIndexOf('/') + 1) || `image_${Date.now()}.jpg`;
                                  
                                  // Convert media URL to api URL if needed
                                  const bypassUrl = viewingImageUrl.replace(/\/media\//, '/api/messaging/files/');
                                  
                                  // PROPER DOWNLOAD - saves to device Gallery
                                  await downloadImage(
                                    bypassUrl,
                                    filename,
                                    filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
                                  );
                                } catch (error) {
                                  console.error('Image download error:', error);
                                } finally {
                                  setIsSharing(false);
                                }
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <FontAwesome name="download" size={24} color="white" />
                    <Text style={styles.imageDownloadButtonText}>Download</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* P0 Feature: Message Actions Modal */}
      {selectedMessage && (
        <MessageActions
          visible={showMessageActions}
          onClose={() => {
            setShowMessageActions(false);
            setSelectedMessage(null);
          }}
          messageId={selectedMessage.id}
          isOwnMessage={selectedMessage.sent}
          messageContent={selectedMessage.text}
          onReply={() => handleReply(selectedMessage.id)}
          onReact={() => handleReaction(selectedMessage.id)}
          onEdit={() => handleEdit(selectedMessage.id, selectedMessage.text)}
          onDelete={() => handleDelete(selectedMessage.id)}
        />
      )}

      {/* P0 Feature: Reaction Picker Modal */}
      {reactionMessage && (
        <MessageReactionPicker
          visible={showReactionPicker}
          onClose={() => {
            setShowReactionPicker(false);
            setReactionMessage(null);
          }}
          onSelectReaction={handleSelectReaction}
          messageId={reactionMessage.id}
          currentReactions={reactionMessage.reactions}
          currentUserId={currentUser?.id || 0}
        />
      )}

      {/* P0 Feature: Edit Message Modal */}
      {editingMessage && (
        <MessageEditModal
          visible={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingMessage(null);
            setEditMessageContent('');
            setEditError(null);
          }}
          messageId={editingMessage.id}
          initialContent={editMessageContent}
          onSave={handleSaveEdit}
          isSaving={isSavingEdit}
          saveError={editError}
        />
      )}

      {/* Delete Conversation Confirmation Modal */}
      <Modal
        transparent={true}
        visible={showDeleteConfirmation}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 400
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: '600',
              color: '#333',
              marginBottom: 16
            }}>
              Delete Conversation?
            </Text>
            <Text style={{
              fontSize: 14,
              color: '#666',
              lineHeight: 20,
              marginBottom: 24
            }}>
              Are you sure you want to delete this conversation with <Text style={{ fontWeight: '600' }}>{name || 'this user'}</Text>?
              {'\n\n'}
              <Text style={{ fontWeight: '600' }}>Important:</Text> Deleting will remove this chat for <Text style={{ fontWeight: '600' }}>both</Text> of you, including all previous messages. This action cannot be undone.
            </Text>
            <View style={{
              flexDirection: 'row',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirmation(false)}
                disabled={isDeletingConversation}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#ddd',
                  backgroundColor: '#fff',
                  opacity: isDeletingConversation ? 0.6 : 1
                }}
              >
                <Text style={{
                  color: '#333',
                  fontSize: 14,
                  fontWeight: '500'
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteConversation}
                disabled={isDeletingConversation}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  backgroundColor: '#dc3545',
                  opacity: isDeletingConversation ? 0.6 : 1
                }}
              >
                <Text style={{
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: '600'
                }}>
                  {isDeletingConversation ? 'Deleting...' : 'Delete Conversation'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      </View>
    </ErrorBoundary>
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
  topBarTitleContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  topBarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  topBarStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  topBarStatusOnline: {
    color: '#4CAF50', // Green for online
  },
  topBarStatusOffline: {
    color: 'rgba(255, 255, 255, 0.7)', // Light gray for offline
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionStatus: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  connectionStatusConnected: {
    color: '#4CAF50',
  },
  connectionStatusConnecting: {
    color: '#FF9800',
  },
  connectionStatusError: {
    color: '#F44336',
  },
  connectionStatusDisconnected: {
    color: '#9E9E9E',
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#e0e0e0',
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
  videoPlayer: {
    width: '100%',
    height: 200,
    maxWidth: 400,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  videoPlayButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  videoPlayText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 8,
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
  downloadIcon: {
    fontSize: 18,
    marginLeft: 8,
    opacity: 0.7,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timestampContainerSent: {
    justifyContent: 'flex-end',
  },
  timestampContainerReceived: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 11,
  },
  timestampSent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  timestampReceived: {
    color: '#666',
  },
  messageStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 4,
  },
  messageStatusRead: {
    color: '#4CAF50', // Green for read messages
  },
  inputBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1C4E80',
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
  
  // Emoji picker styles
  emojiButton: {
    padding: 12,
    marginRight: 8,
  },
  emojiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  emojiModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    height: '60%',
  },
  emojiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emojiModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emojiModalCloseButton: {
    padding: 8,
  },
  emojiModalCloseText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  emojiSelectorWrapper: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 300,
    maxHeight: Dimensions.get('window').height * 0.5,
  },
  emojiGrid: {
    flex: 1,
    padding: 10,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  emojiButton: {
    padding: 8,
    margin: 4,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  emojiText: {
    fontSize: 24,
    textAlign: 'center',
  },
  
  // Typing Indicator Styles
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    maxWidth: 200,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 3,
    marginHorizontal: 2,
  },
  typingDot1: {
    // Note: React Native doesn't support CSS animations directly
    // You would need to use Animated API for proper animations
  },
  typingDot2: {
    // Note: React Native doesn't support CSS animations directly
  },
  typingDot3: {
    // Note: React Native doesn't support CSS animations directly
  },
  typingText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
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
  imageDownloadButton: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 120,
  },
  imageDownloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // P0 Features: Reply Preview Styles
  replyPreviewContainer: {
    marginVertical: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  replyPreviewSent: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  replyPreviewReceived: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyBar: {
    width: 3,
    backgroundColor: '#1C4E80',
    borderRadius: 2,
    marginRight: 8,
    alignSelf: 'stretch',
  },
  replyContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  replyTextContainer: {
    marginLeft: 6,
    flex: 1,
  },
  replySenderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replySenderNameSent: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  replySenderNameReceived: {
    color: '#1C4E80',
  },
  replyMessageText: {
    fontSize: 12,
  },
  replyMessageTextSent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  replyMessageTextReceived: {
    color: '#666',
  },
  
  // P0 Features: Reactions Display Styles
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 4,
  },
  reactionBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
  },
  reactionBubbleOwn: {
    backgroundColor: '#1C4E80',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  
  // P0 Features: Edited Indicator Styles
  editedIndicator: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 4,
  },
  editedIndicatorSent: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  editedIndicatorReceived: {
    color: '#888',
  },
});

export default ChatMessageScreen;
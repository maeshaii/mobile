import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, FlatList, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { listMessages, markConversationRead, sendMessage as sendMessageApi, getWebSocketBase } from '../../services/api';
import { ConversationWebSocket, TypingIndicator, WsEvent } from '../../services/websocketHelper';

const samplePic = require('../../assets/images/sample_pic.jpg');

type UiMsg = { id: string; text: string; sent: boolean; tempId?: string };

const ChatMessageScreen = () => {
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const { name, conversationId } = useLocalSearchParams();
  const wsRef = useRef<ConversationWebSocket | null>(null);
  const typingIndicatorRef = useRef<TypingIndicator | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedAsRead = useRef(false);

  useEffect(() => {
    // Load initial messages
    async function load() {
      if (!conversationId) return;
      try {
        const data = await listMessages(Number(conversationId));
        const arr = Array.isArray(data?.results) ? data.results : [];
        const mapped: UiMsg[] = arr.map((m: any) => ({ 
          id: String(m.message_id), 
          text: m.content, 
          sent: m?.sender?.is_me === true
        }));
        setMessages(mapped);
        setNextCursor(data.next_cursor ?? null);
      } catch (e) {
        console.warn('Failed to load messages', e);
      }
    }
    load();
  }, [conversationId]);

  useEffect(() => {
    // Connect WebSocket
    if (!conversationId) return;

    const ws = new ConversationWebSocket(Number(conversationId), getWebSocketBase());
    wsRef.current = ws;
    
    const typingIndicator = new TypingIndicator(ws);
    typingIndicatorRef.current = typingIndicator;

    ws.onStatus((status) => {
      setConnectionStatus(status);
      if (status === 'connected' && !hasMarkedAsRead.current) {
        // Mark conversation as read when connected
        markConversationRead(Number(conversationId)).catch(() => {});
        hasMarkedAsRead.current = true;
      }
    });

    ws.onMessage((event: WsEvent) => {
      switch (event.type) {
        case 'message':
          setMessages((prev) => {
            // Remove temp message if it exists
            const filtered = prev.filter(m => m.tempId !== event.temp_id);
            return [...filtered, { 
              id: String(event.message_id), 
              text: event.content, 
              sent: false 
            }];
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
      ws.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId]);

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
    if (!text) return;
    
    const tempId = Date.now().toString();
    setMessages((prev) => [...prev, { id: tempId, text, sent: true, tempId }]);
    setInput('');
    
    // Stop typing indicator
    typingIndicatorRef.current?.sendTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      if (conversationId) {
        // Send via REST for persistence
        await sendMessageApi(Number(conversationId), { content: text, message_type: 'text' });
        // Also send via WS to trigger real-time update for others
        wsRef.current?.send({ type: 'message', message: text, message_type: 'text', temp_id: tempId });
      }
    } catch (e) {
      console.warn('Send failed', e);
      // Remove failed message from UI
      setMessages((prev) => prev.filter(m => m.tempId !== tempId));
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const loadMore = async () => {
    if (!conversationId || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await listMessages(Number(conversationId), { cursor: nextCursor, limit: 50 });
      const arr = Array.isArray(data?.results) ? data.results : [];
      const mapped: UiMsg[] = arr.map((m: any) => ({ id: String(m.message_id), text: m.content, sent: false }));
      // Prepend older messages
      setMessages((prev) => [...mapped, ...prev]);
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
      }, 2000);
    } else {
      typingIndicatorRef.current?.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

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
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.sent ? styles.bubbleSent : styles.bubbleReceived
          ]}>
            <Text style={[
              styles.bubbleText,
              item.sent ? styles.bubbleTextSent : styles.bubbleTextReceived
            ]}>
              {item.text}
            </Text>
          </View>
        )}
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
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
  },
  bubbleReceived: {
    backgroundColor: '#F5F5F5',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleSent: {
    backgroundColor: '#1C4E80',
    alignSelf: 'flex-end',
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

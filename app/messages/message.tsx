import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';
import { listConversations, ConversationSummary, getOnlineUsers } from '../../services/api';
import { NotificationWebSocket } from '../../services/notificationWebSocket';
import UserAvatar from '../../components/UserAvatar';

type Row = {
  id: number;
  name: string;
  lastMessage: string;
  date: string;
  profilePic?: string;
  firstName?: string;
  lastName?: string;
  unread: number;
  isMessageRequest?: boolean;
  isOnline?: boolean;
};

const MessageScreen = () => {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [filteredRows, setFilteredRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'request' | 'online'>('all');
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationWs, setNotificationWs] = useState<NotificationWebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Load current user and setup notification WebSocket
  useEffect(() => {
    const setupNotificationWebSocket = async () => {
      try {
        const { getUserInfo } = await import('../../services/api');
        const user = await getUserInfo();
        setCurrentUser(user);
        
        if (user?.user_id) {
          const { API_BASE_URL } = await import('../../services/api');
          const { getAccessToken } = await import('../../services/api');
          const token = await getAccessToken();
          
          const ws = new NotificationWebSocket(user.user_id, API_BASE_URL, token);
          
          ws.onNotification((event) => {
            console.log('Notification received:', event);
            // Reload conversations when new notification arrives
            load();
          });
          
          ws.onStatus((status) => {
            console.log('Notification WebSocket status:', status);
          });
          
          await ws.connect();
          setNotificationWs(ws);
        }
      } catch (error) {
        console.error('Failed to setup notification WebSocket:', error);
      }
    };
    
    setupNotificationWebSocket();
    
    return () => {
      if (notificationWs) {
        notificationWs.disconnect();
      }
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data: ConversationSummary[] = await listConversations();
      const mapped: Row[] = (data || []).map((c: ConversationSummary) => {
        // Parse the full name to extract first and last names
        const fullName = c.other_participant?.name || 'Conversation';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          id: c.conversation_id,
          name: fullName,
          lastMessage: c.last_message?.content || '',
          date: new Date(c.updated_at).toLocaleDateString(),
          profilePic: c.other_participant?.avatar_url || undefined,
          firstName,
          lastName,
          unread: c.unread_count || 0,
          isMessageRequest: c.is_message_request || false,
          isOnline: false, // Will be updated after loading online users
        };
      });
      setRows(mapped);
      
      // Load online users
      try {
        const onlineResponse = await getOnlineUsers();
        if (onlineResponse.success) {
          const onlineUserIds = new Set<number>(onlineResponse.online_users.map((user: any) => user.user_id));
          setOnlineUsers(onlineUserIds);
          
          // Update rows with online status
          const updatedRows = mapped.map(row => ({
            ...row,
            isOnline: onlineUserIds.has(row.id) || false
          }));
          setRows(updatedRows);
        }
      } catch (error) {
        console.warn('Failed to load online users:', error);
      }
    } catch (e) {
      console.warn('Failed to load conversations', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Filter conversations based on active filter and search query
  useEffect(() => {
    let filtered = rows;
    
    // Apply filter
    if (activeFilter === 'request') {
      filtered = rows.filter(row => row.isMessageRequest);
    } else if (activeFilter === 'online') {
      filtered = rows.filter(row => row.isOnline);
    }
    
    // Apply search
    if (searchQuery.trim()) {
      filtered = filtered.filter(row => 
        row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredRows(filtered);
  }, [rows, activeFilter, searchQuery]);

  // Reload conversations when screen comes into focus (e.g., returning from chat)
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
     
      <NavBar />
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={16} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <FontAwesome name="times" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'all' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>
            All Messages
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'request' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('request')}
        >
          <Text style={[styles.filterText, activeFilter === 'request' && styles.activeFilterText]}>
            Message Request
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'online' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('online')}
        >
          <Text style={[styles.filterText, activeFilter === 'online' && styles.activeFilterText]}>
            Online
          </Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.messageCard}
            onPress={() => router.push({ pathname: '/messages/chatmessage', params: { conversationId: String(item.id), name: item.name } })}
          >
            <View style={styles.avatarContainer}>
              <UserAvatar
                profilePic={item.profilePic}
                firstName={item.firstName}
                lastName={item.lastName}
                size={44}
                style={styles.avatar}
              />
              {item.isOnline && <View style={styles.onlineIndicator} />}
            </View>
            <View style={styles.messageBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={styles.nameContainer}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.isMessageRequest && <Text style={styles.messageRequestIndicator}>📩</Text>}
                </View>
                <Text style={styles.date}>{item.date}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.message} numberOfLines={1}>{item.lastMessage}</Text>
                {item.unread > 0 && (
                  <View style={{ backgroundColor: '#1C4E80', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
      
      {/* Floating Action Button */}
      <TouchableOpacity 
        onPress={() => router.push('/messages/search' as Href)}
        style={styles.floatingButton}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 0,
    paddingLeft: 5,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 22,
    color: '#222',
    paddingLeft: 5,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#1C4E80',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 15,
    backgroundColor: '#eee',
  },
  messageBox: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  message: {
    fontSize: 13,
    color: '#333',
  },
  date: {
    fontSize: 13,
    color: '#888',
    marginLeft: 10,
    alignSelf: 'flex-start',
  },
  // Filter tabs
  filterContainer: {
    flexDirection: 'row',
    marginHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeFilterTab: {
    backgroundColor: '#1C4E80',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Avatar container for online indicator
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Name container for message request indicator
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageRequestIndicator: {
    fontSize: 14,
    opacity: 0.8,
  },
  
  // Search bar styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
});

export default MessageScreen;
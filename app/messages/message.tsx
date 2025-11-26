import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';
import { listConversations, ConversationSummary, getOnlineUsers, createConversation } from '../../services/api';
import { NotificationWebSocket } from '../../services/notificationWebSocket';
import UserAvatar from '../../components/UserAvatar';
import ErrorBoundary from '../../components/ErrorBoundary';
import { formatUserFullName } from '../../utils/nameUtils';
import { useDebounce } from '../../hooks/useDebounce';
import { profilePicCache } from '../../services/profilePicCache';

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
  targetUserId?: number; // for virtual online rows without existing conversation
};

const MessageScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [filteredRows, setFilteredRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'request' | 'online'>('all');
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [onlineUsersData, setOnlineUsersData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationWs, setNotificationWs] = useState<NotificationWebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // P0 Feature: Debounced search for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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
      const mapped: Row[] = await Promise.all((data || []).map(async (c: ConversationSummary) => {
        // Parse the full name to extract first and last names
        const fullName = c.other_participant?.name || 'Conversation';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // P0 Feature: Use profile picture cache for better performance
        let cachedProfilePic: string | null = null;
        if (c.other_participant?.user_id) {
          try {
            cachedProfilePic = await profilePicCache.get(
              c.other_participant.user_id,
              c.other_participant.avatar_url
            );
          } catch (error) {
            console.warn('Failed to get cached profile pic:', error);
          }
        }
        
        // Debug: Log avatar URL for first few conversations
        if (c.conversation_id <= 5) {
          console.log(`[Avatar Debug] Conversation ${c.conversation_id} (${fullName}):`, {
            avatar_url: c.other_participant?.avatar_url,
            cached_url: cachedProfilePic,
            firstName,
            lastName,
            initials: firstName && lastName ? `${firstName[0]}${lastName[0]}` : firstName ? firstName[0] : '?'
          });
        }
        
        return {
          id: c.conversation_id,
          name: fullName,
          lastMessage: c.last_message?.content || '',
          date: new Date(c.updated_at).toLocaleDateString(),
          profilePic: cachedProfilePic || c.other_participant?.avatar_url || undefined,
          firstName,
          lastName,
          unread: c.unread_count || 0,
          // Ensure is_message_request is properly mapped (explicit boolean check)
          isMessageRequest: c.is_message_request === true || c.is_message_request === 'true' || false,
          // online to be determined via other participant's user_id
          isOnline: false,
        };
      }));
      setRows(mapped);
      
      // Load online users
      try {
        const onlineResponse = await getOnlineUsers();
        console.log('[Mobile Online Users] API Response:', onlineResponse);
        if (onlineResponse.success) {
          // Ensure all user_ids are numbers for consistent Set operations
          const onlineUserIds = new Set<number>(
            onlineResponse.online_users.map((user: any) => Number(user.user_id))
          );
          console.log('[Mobile Online Users] Setting online users:', {
            count: onlineUserIds.size,
            userIds: Array.from(onlineUserIds),
            users: onlineResponse.online_users.map((u: any) => ({ user_id: u.user_id, name: u.name }))
          });
          setOnlineUsers(onlineUserIds);
          setOnlineUsersData(onlineResponse.online_users);
          
          // Update rows with online status using other participant's user_id
          const updatedRows = (data || []).map((c: ConversationSummary, idx: number) => {
            const otherUserId = c.other_participant?.user_id;
            const isOnline = otherUserId ? onlineUserIds.has(Number(otherUserId)) : false;
            if (isOnline) {
              console.log(`[Mobile Online Users] Marking ${c.other_participant?.name} (${otherUserId}) as online`);
            }
            return {
              ...mapped[idx],
              isOnline,
            };
          });
          setRows(updatedRows);
        } else {
          console.warn('[Mobile Online Users] API returned success=false:', onlineResponse);
        }
      } catch (error) {
        console.warn('[Mobile Online Users] Failed to load online users:', error);
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
    if (activeFilter === 'all') {
      // All Messages should EXCLUDE message requests AND empty conversations (no messages sent)
      filtered = rows.filter(row => {
        // CRITICAL: Exclude message requests - they should NEVER appear in All Messages
        // Double-check to ensure isMessageRequest is properly set
        if (row.isMessageRequest === true) {
          return false;
        }
        // Additional safety check: if isMessageRequest is undefined/null, treat as false (regular conversation)
        // But if it's explicitly true, exclude it
        if (row.isMessageRequest) {
          return false;
        }
        // Exclude conversations with no messages (empty conversations)
        // A conversation should only appear if it has at least one message
        if (!row.lastMessage || row.lastMessage.trim() === '') return false;
        return true;
      });
    } else if (activeFilter === 'request') {
      filtered = rows.filter(row => row.isMessageRequest);
    } else if (activeFilter === 'online') {
      console.log('[Mobile Online Filter] Checking online status:', {
        totalRows: rows.length,
        onlineUsersCount: onlineUsers.size,
        onlineUsersDataCount: onlineUsersData?.length || 0,
        onlineUserIds: Array.from(onlineUsers),
        onlineUsersData: onlineUsersData?.map((u: any) => ({ user_id: u.user_id, name: u.name })) || []
      });

      // 1) Existing conversations whose other participant is online
      // Check both isOnline property AND onlineUsers Set for reliability
      const existingOnline = rows.filter(row => {
        const isOnlineByProperty = row.isOnline;
        const isOnlineBySet = row.targetUserId ? onlineUsers.has(Number(row.targetUserId)) : false;
        const isOnline = isOnlineByProperty || isOnlineBySet;
        
        if (isOnline) {
          console.log(`[Mobile Online Filter] Found online conversation: ${row.name} (user_id: ${row.targetUserId})`);
        }
        return isOnline;
      });
      
      console.log(`[Mobile Online Filter] Found ${existingOnline.length} existing online conversations`);

      // 2) Virtual items for online mutuals without an existing conversation
      const existingOtherIds = new Set<number>(
        rows
          .map(r => r.targetUserId)
          .filter(Boolean)
          .map(id => Number(id))
      );

      console.log(`[Mobile Online Filter] Existing conversation user IDs:`, Array.from(existingOtherIds));

      const virtualRows: Row[] = (onlineUsersData || [])
        .filter((u: any) => {
          const userId = Number(u.user_id);
          const isExisting = existingOtherIds.has(userId);
          if (!isExisting) {
            console.log(`[Mobile Online Filter] Adding virtual item for: ${u.name || formatUserFullName(u)} (user_id: ${userId})`);
          }
          return !isExisting;
        })
        .map((u: any) => ({
          id: -Number(u.user_id), // sentinel negative id for virtual row
          targetUserId: Number(u.user_id),
          name: u.name || formatUserFullName(u),
          lastMessage: '',
          date: new Date().toLocaleDateString(),
          profilePic: u.profile_pic || undefined,
          firstName: u.f_name,
          lastName: u.l_name,
          unread: 0,
          isMessageRequest: false,
          isOnline: true,
        }));
      
      console.log(`[Mobile Online Filter] Created ${virtualRows.length} virtual items`);
      console.log(`[Mobile Online Filter] Total filtered conversations: ${existingOnline.length + virtualRows.length}`);

      filtered = [...existingOnline, ...virtualRows];
    }
    
    // P0 Feature: Apply debounced search for better performance
    if (debouncedSearchQuery.trim()) {
      filtered = filtered.filter(row => 
        row.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        row.lastMessage.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }
    
    setFilteredRows(filtered);
  }, [rows, activeFilter, debouncedSearchQuery, onlineUsersData]);

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
    <ErrorBoundary onReset={() => {
      // Reload conversations on error reset
      load();
    }}>
      <View style={styles.container}>
     
      <NavBar />
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
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
            onPress={async () => {
              // If virtual row, create conversation first
              if (item.id < 0 && item.targetUserId) {
                try {
                  const newConv = await createConversation(item.targetUserId);
                  router.push({ pathname: '/messages/chatmessage', params: { conversationId: String(newConv.conversation_id), name: item.name } });
                  return;
                } catch (e) {
                  console.warn('Failed to create conversation from Online tab (mobile):', e);
                  return;
                }
              }
              router.push({ pathname: '/messages/chatmessage', params: { conversationId: String(item.id), name: item.name } });
            }}
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
                  {activeFilter !== 'online' && item.isMessageRequest && (
                    <Text style={styles.messageRequestIndicator}>📩</Text>
                  )}
                </View>
                {activeFilter !== 'online' && (
                  <Text style={styles.date}>{item.date}</Text>
                )}
              </View>
              {activeFilter !== 'online' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.message} numberOfLines={1}>{item.lastMessage}</Text>
                  {item.unread > 0 && (
                    <View style={{ backgroundColor: '#1C4E80', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 12 }}>{item.unread}</Text>
                    </View>
                  )}
                </View>
              )}
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
    </ErrorBoundary>
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
    paddingTop: 18,
    marginBottom: 0,
    paddingLeft: 5,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 27,
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
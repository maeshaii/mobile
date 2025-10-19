import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import UserAvatar from '../../components/UserAvatar';
import { fetchFollowers, fetchFollowing, followUser, unfollowUser, getUserInfo } from '../../services/api';
import api from '../../services/api';

const { width } = Dimensions.get('window');

interface FollowUser {
  user_id: number;
  ctu_id: string;
  name: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
  followed_at?: string;
  batch?: string;
  year_graduated?: string;
}

interface FollowModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'followers' | 'following';
  userId: number;
}

export default function FollowModal({ visible, onClose, type, userId }: FollowModalProps) {
  const router = useRouter();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followStatuses, setFollowStatuses] = useState<{ [key: number]: boolean }>({});
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});



  const loadUsers = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get data from API - match web frontend approach
      const response = await api.get(`api/alumni/${userId}/${type}/`);
      const data = response.data;
      
      // Debug: Log the response to understand the data structure
      console.log(`API Response for ${type}:`, data);


      
      let usersArray: any[] = [];
      if (type === 'followers' && Array.isArray(data.followers)) {
        usersArray = data.followers;
      } else if (type === 'following' && Array.isArray(data.following)) {
        usersArray = data.following;
      } else if (Array.isArray(data)) {
        usersArray = data;
      } else {
        usersArray = [];
      }


      // Use the data directly from backend - match web frontend approach
      const normalizedUsers = usersArray.map((u: any) => ({
        user_id: u.user_id,
        ctu_id: u.ctu_id,
        name: u.name,
        f_name: u.f_name,
        l_name: u.l_name,
        profile_pic: u.profile_pic,
        followed_at: u.followed_at,
        batch: u.batch || u.year_graduated,
        year_graduated: u.year_graduated,
      }));

      setUsers(normalizedUsers);
      console.log(`Set ${normalizedUsers.length} users for ${type}`);

      if (normalizedUsers.length > 0) {
        const currentUser = await getUserInfo();
        const currentUserId = currentUser?.id || currentUser?.user_id;

        const statusPromises = normalizedUsers.map(async (user: FollowUser) => {
          try {
            const { checkFollowStatus } = await import('../../services/api');
            const status = await checkFollowStatus(user.user_id);
            return { userId: user.user_id, isFollowing: status.is_following || false };
          } catch {
            return { userId: user.user_id, isFollowing: false };
          }
        });

        const statuses = await Promise.all(statusPromises);
        const statusMap: { [key: number]: boolean } = {};
        statuses.forEach(status => {
          statusMap[status.userId] = status.isFollowing;
        });
        setFollowStatuses(statusMap);
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
      Alert.alert('Error', `Failed to load ${type} for user ${userId}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  useEffect(() => {
    console.log('FollowModal: useEffect triggered', { visible, userId, type });
    if (visible && userId) {
      console.log('FollowModal: useEffect - calling loadUsers');
      loadUsers();
    } else {
      console.log('FollowModal: useEffect - not loading users', { visible, userId });
    }
  }, [visible, userId, type]);

  const handleFollow = async (targetUserId: number) => {
    try {
      setFollowLoading(prev => ({ ...prev, [targetUserId]: true }));

      const isCurrentlyFollowing = followStatuses[targetUserId];

      if (isCurrentlyFollowing) {
        const res = await unfollowUser(targetUserId);
        if (res?.success) {
          setFollowStatuses(prev => ({ ...prev, [targetUserId]: false }));
        }
      } else {
        const res = await followUser(targetUserId);
        if (res?.success) {
          setFollowStatuses(prev => ({ ...prev, [targetUserId]: true }));
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };


  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {type === 'followers' ? 'Followers' : 'Following'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color="#174f84" />
            </TouchableOpacity>
          </View>
          

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#174f84" />
              <Text style={styles.loadingText}>Loading {type}...</Text>
            </View>
          ) : (
            <>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#174f84"]}
                  tintColor="#174f84"
                />
              }
            >
              {users.length > 0 ? (
                <View style={styles.gridContainer}>
                  {users.map((user, idx) => {
                    return (
                      <TouchableOpacity 
                        key={user.user_id || idx} 
                        style={styles.userCard}
                        onPress={() => {
                          onClose();
                          router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: user.user_id } });
                        }}
                      >
                        <UserAvatar
                          profilePic={user.profile_pic}
                          firstName={user.f_name}
                          lastName={user.l_name}
                          size={80}
                          style={styles.cardAvatar}
                        />
                        <View style={styles.cardUserInfo}>
                          <Text style={styles.cardUserName} numberOfLines={2}>
                            {user.name || `${user.f_name || ''} ${user.l_name || ''}`.trim()}
                          </Text>
                          {user.batch && (
                            <Text style={styles.cardUserBatch}>
                              Batch {user.batch}
                            </Text>
                          )}
                          <Text style={styles.cardUserHandle}>@{user.ctu_id}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.cardFollowButton, followStatuses[user.user_id] && styles.cardFollowingButton]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleFollow(user.user_id);
                          }}
                          disabled={followLoading[user.user_id]}
                        >
                          <Text style={[styles.cardFollowButtonText, followStatuses[user.user_id] && styles.cardFollowingButtonText]}>
                            {followLoading[user.user_id] ? '...' : followStatuses[user.user_id] ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <FontAwesome
                    name={type === 'followers' ? 'users' : 'user-plus'}
                    size={48}
                    color="#ccc"
                  />
                  <Text style={styles.emptyText}>No {type} yet</Text>
                  <Text style={styles.emptySubText}>
                    {type === 'followers' 
                      ? 'This user doesn\'t have any followers yet.' 
                      : 'This user isn\'t following anyone yet.'}
                  </Text>
                </View>
              )}
            </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxWidth: 500,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  list: {
    flex: 1,
    minHeight: 300,
    maxHeight: 500,
  },
  listContent: {
    padding: 16,
  },
  // Grid layout styles - similar to web frontend
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  userCard: {
    width: (width - 80) / 2, // Two columns with gap
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardAvatar: {
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#f0f0f0',
  },
  cardUserInfo: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  cardUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardUserBatch: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  cardUserHandle: {
    fontSize: 12,
    color: '#999',
  },
  cardFollowButton: {
    backgroundColor: '#174f84',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  cardFollowingButton: {
    backgroundColor: '#e3ecf7',
    borderWidth: 1,
    borderColor: '#174f84',
  },
  cardFollowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardFollowingButtonText: {
    color: '#174f84',
  },
  // Legacy list styles (keeping for backward compatibility)
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
    backgroundColor: '#fff',
    minHeight: 60,
  },
  avatar: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 14,
    color: '#666',
  },
  followButton: {
    backgroundColor: '#174f84',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: '#e3ecf7',
    borderWidth: 1,
    borderColor: '#174f84',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#174f84',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

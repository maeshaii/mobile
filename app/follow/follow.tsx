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
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import UserAvatar from '../../components/UserAvatar';
import { fetchFollowers, fetchFollowing, followUser, unfollowUser, getUserInfo } from '../../services/api';
import api from '../../services/api';

interface FollowUser {
  user_id: number;
  ctu_id: string;
  name: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
  followed_at?: string;
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

      // Use the existing API functions
      let data: any;
      if (type === 'followers') {
        data = await fetchFollowers(userId);
      } else {
        data = await fetchFollowing(userId);
      }

      // Extract users array from the response
      let usersArray: any[] = [];
      
      if (data && data.success && data[type]) {
        usersArray = data[type];
      } else {
        usersArray = [];
      }

      // Normalize the user data
      const normalizedUsers = usersArray.map((u: any) => ({
        user_id: u.user_id || u.id,
        ctu_id: u.ctu_id || u.acc_username || `user_${u.user_id || u.id}`,
        name: u.name || `${u.f_name || ''} ${u.l_name || ''}`.trim() || `User ${u.user_id || u.id}`,
        f_name: u.f_name,
        l_name: u.l_name,
        profile_pic: u.profile_pic,
        followed_at: u.followed_at,
      }));

      
      // If no normalized users, try to use raw data
      if (normalizedUsers.length === 0 && usersArray.length > 0) {
        const rawUsers = usersArray.map((u: any) => ({
          user_id: u.user_id || u.id || Math.random(),
          ctu_id: u.ctu_id || u.acc_username || 'unknown',
          name: u.name || u.f_name || 'Unknown User',
          f_name: u.f_name || '',
          l_name: u.l_name || '',
          profile_pic: u.profile_pic,
          followed_at: u.followed_at,
        }));
        setUsers(rawUsers);
      } else {
        setUsers(normalizedUsers);
      }

      const finalUsers = normalizedUsers.length > 0 ? normalizedUsers : users;
      if (finalUsers.length > 0) {
        const currentUser = await getUserInfo();
        const currentUserId = currentUser?.id || currentUser?.user_id;

        const statusPromises = finalUsers.map(async (user: FollowUser) => {
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
            {/* Users Grid - Outside ScrollView for guaranteed visibility */}
            {users.length > 0 ? (
              <View style={styles.gridContainer}>
                <View style={styles.gridWrapper}>
                  {users.map((user, idx) => (
                    <TouchableOpacity 
                      key={user.user_id || idx} 
                      style={styles.gridItem}
                      onPress={() => {
                        onClose();
                        router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: user.user_id } });
                      }}
                    >
                      <UserAvatar
                        profilePic={user.profile_pic}
                        firstName={user.f_name}
                        lastName={user.l_name}
                        size={60}
                        style={styles.gridAvatar}
                      />
                      <Text style={styles.gridUserName} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <Text style={styles.gridUserHandle} numberOfLines={1}>
                        @{user.ctu_id}
                      </Text>
                      <TouchableOpacity
                        style={[styles.gridFollowButton, followStatuses[user.user_id] && styles.gridFollowingButton]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleFollow(user.user_id);
                        }}
                        disabled={followLoading[user.user_id]}
                      >
                        <Text style={[styles.gridFollowButtonText, followStatuses[user.user_id] && styles.gridFollowingButtonText]}>
                          {followLoading[user.user_id] ? '...' : followStatuses[user.user_id] ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <FontAwesome
                  name={type === 'followers' ? 'users' : 'user-plus'}
                  size={48}
                  color="#ccc"
                />
                <Text style={styles.emptyText}>No {type} yet</Text>
              </View>
            )}
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
    backgroundColor: 'rgba(0,0,0,0.8)', // Made darker for better visibility
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
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
    maxHeight: 400,
  },
  listContent: {
    paddingBottom: 20,
  },
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
  },

  // Grid Layout Styles
  gridContainer: {
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  gridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  gridAvatar: {
    marginBottom: 8,
  },
  gridUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
    marginBottom: 4,
  },
  gridUserHandle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  gridFollowButton: {
    backgroundColor: '#174f84',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  gridFollowingButton: {
    backgroundColor: '#e3ecf7',
    borderWidth: 1,
    borderColor: '#174f84',
  },
  gridFollowButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  gridFollowingButtonText: {
    color: '#174f84',
  },
});

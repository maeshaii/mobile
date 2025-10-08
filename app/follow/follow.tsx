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

  console.log('FollowModal: Component rendered with props:', { visible, type, userId });


  const loadUsers = async () => {
    if (!userId) {
      console.log('FollowModal: No userId provided, skipping load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log(`FollowModal: Loading ${type} for userId:`, userId);

      // Get data from API - match web frontend approach
      const response = await api.get(`/api/alumni/${userId}/${type}/`);
      const data = response.data;

      console.log(`FollowModal: ${type} API response:`, data);

      // Extract users array - match web frontend logic
      let usersArray: any[] = [];
      if (data.success && data[type]) {
        usersArray = data[type];
        console.log(`FollowModal: Extracted ${usersArray.length} ${type} from data.${type}`);
      } else {
        console.log(`FollowModal: No valid ${type} array found in response. Data structure:`, Object.keys(data || {}));
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
      }));

      console.log(`FollowModal: Found ${normalizedUsers.length} users`);
      setUsers(normalizedUsers);

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
    if (visible && userId) {
      loadUsers();
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

  const renderUser = ({ item }: { item: FollowUser }) => {
    const isFollowing = followStatuses[item.user_id] || false;
    const isLoading = followLoading[item.user_id] || false;

    console.log(`FollowModal: Rendering user:`, {
      user_id: item.user_id,
      name: item.name,
      ctu_id: item.ctu_id,
      f_name: item.f_name,
      l_name: item.l_name
    });


    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => {
          onClose();
          router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: item.user_id } });
        }}
      >
        <UserAvatar
          profilePic={item.profile_pic}
          firstName={item.f_name}
          lastName={item.l_name}
          size={50}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userHandle}>@{item.ctu_id}</Text>
        </View>
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={(e) => {
            e.stopPropagation();
            handleFollow(item.user_id);
          }}
          disabled={isLoading}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
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
                users.map((user) => renderUser({ item: user }))
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
});

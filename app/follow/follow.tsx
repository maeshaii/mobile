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
  RefreshControl
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import UserAvatar from '../../components/UserAvatar';
import { fetchFollowers, fetchFollowing, followUser, unfollowUser, getUserInfo } from '../../services/api';

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

      // Always get data from API
      const data = type === 'followers'
        ? await fetchFollowers(userId)
        : await fetchFollowing(userId);

      // Force users array extraction
      let usersArray: any[] = [];
      if (type === 'followers' && Array.isArray(data?.followers)) {
        usersArray = data.followers;
      } else if (type === 'following' && Array.isArray(data?.following)) {
        usersArray = data.following;
      } else if (Array.isArray(data)) {
        usersArray = data;
      } else if (Array.isArray(data?.results)) {
        usersArray = data.results;
      }

      const normalizedUsers = (usersArray || []).map((u: any) => ({
        user_id: u.user_id || u.id,
        ctu_id: u.ctu_id,
        name: u.name || `${u.f_name || u.first_name || ''} ${u.l_name || u.last_name || ''}`.trim(),
        f_name: u.f_name || u.first_name || '',
        l_name: u.l_name || u.last_name || '',
        profile_pic: u.profile_pic,
        followed_at: u.followed_at,
      }));

      console.log(`Normalized ${type} users:`, normalizedUsers);
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
            <FlatList
              data={users}
              keyExtractor={(item) => item.user_id.toString()}
              renderItem={renderUser}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#174f84"]}
                  tintColor="#174f84"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <FontAwesome
                    name={type === 'followers' ? 'users' : 'user-plus'}
                    size={48}
                    color="#ccc"
                  />
                  <Text style={styles.emptyText}>No {type} yet</Text>
                </View>
              }
            />
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

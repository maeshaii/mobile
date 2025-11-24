import React, { useState, useEffect } from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import UserAvatar from '../../components/UserAvatar';
import { fetchFollowers, fetchFollowing, followUser, unfollowUser, getUserInfo } from '../../services/api';
import { formatUserFullName } from '../../utils/nameUtils';
import api from '../../services/api';
import { wp, hp, rf, getPercentageWidth, getResponsivePadding, getResponsiveFontSize, isTablet } from '../../utils/responsive';

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
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const loadUsers = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get data from API
      const response = await api.get(`/api/alumni/${userId}/${type}/`);
      const data = response.data;
      
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

      // Normalize user data
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
				const currentId = currentUser?.id || currentUser?.user_id;
				setCurrentUserId(typeof currentId === 'number' ? currentId : null);

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
        await unfollowUser(targetUserId);
        setFollowStatuses(prev => ({ ...prev, [targetUserId]: false }));
      } else {
        await followUser(targetUserId);
        setFollowStatuses(prev => ({ ...prev, [targetUserId]: true }));
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
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
            <View style={styles.contentContainer}>
              {users.length > 0 ? (
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.user_id.toString()}
                  renderItem={({ item: user, index }) => (
                    <View style={styles.userCard}>
                      <TouchableOpacity 
                        style={styles.userCardContent}
                        onPress={() => {
                          onClose();
                          const isCurrentUser = currentUserId && user.user_id === currentUserId;
                          if (isCurrentUser) {
                            router.push('/profile/profilepage');
                          } else {
                            router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: user.user_id } });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <UserAvatar
                          profilePic={user.profile_pic}
                          firstName={user.f_name}
                          lastName={user.l_name}
                          size={50}
                          style={styles.avatar}
                        />
                        <View style={styles.userInfo}>
                          <Text style={styles.userName} numberOfLines={1}>
                            {user.name || formatUserFullName(user)}
                          </Text>
                          <Text style={styles.userHandle}>@{user.ctu_id}</Text>
                        </View>
                      </TouchableOpacity>
                      {currentUserId !== user.user_id && (
                        <TouchableOpacity
                          style={[
                            styles.followButton,
                            followStatuses[user.user_id] && styles.followingButton
                          ]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleFollow(user.user_id);
                          }}
                          disabled={followLoading[user.user_id]}
                        >
                          <Text style={[
                            styles.followButtonText,
                            followStatuses[user.user_id] && styles.followingButtonText
                          ]}>
                            {followLoading[user.user_id] ? '...' : followStatuses[user.user_id] ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={["#174f84"]}
                      tintColor="#174f84"
                    />
                  }
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={true}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <FontAwesome
                    name={type === 'followers' ? 'users' : 'user-plus'}
                    size={48}
                    color="#ccc"
                  />
                  <Text style={styles.emptyText}>
                    {type === 'followers' ? 'No followers yet.' : 'No following yet.'}
                  </Text>
                </View>
              )}
            </View>
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
    borderRadius: wp(16),
    width: getPercentageWidth(90),
    maxWidth: isTablet() ? wp(500) : wp(400),
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: getResponsivePadding(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  closeButton: {
    padding: wp(8),
  },
  loadingContainer: {
    padding: hp(40),
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp(10),
    fontSize: getResponsiveFontSize(16),
    color: '#666',
  },
  contentContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: hp(20),
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getResponsivePadding(16),
    paddingVertical: getResponsivePadding(12),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: hp(70),
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    marginRight: wp(12),
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '600',
    color: '#000',
    marginBottom: hp(2),
  },
  userHandle: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
  },
  followButton: {
    backgroundColor: '#174f84',
    paddingHorizontal: wp(20),
    paddingVertical: hp(8),
    borderRadius: wp(20),
    minWidth: wp(90),
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: '#6c757d',
  },
  followButtonText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(13),
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#fff',
  },
  emptyContainer: {
    padding: hp(40),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '600',
    color: '#666',
    marginTop: hp(16),
  },
  emptySubText: {
    fontSize: getResponsiveFontSize(14),
    color: '#999',
    marginTop: hp(8),
    textAlign: 'center',
  },
});
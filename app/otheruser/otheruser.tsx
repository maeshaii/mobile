import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  getAlumniDetails, 
  followUser, 
  unfollowUser, 
  checkFollowStatus,
  getPostsByUserType,
  getUserInfo,
  getPosts,
  fetchFollowers,
  fetchFollowing
} from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import PostCard from '../posts/postCard';
import FollowModal from '../follow/follow';

interface UserProfile {
  id: number;
  name?: string;
  f_name: string;
  l_name: string;
  profile_pic?: string;
  profile_bio?: string;
  year_graduated?: number;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
}

interface Post {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id?: number;
  };
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  created_at: string;
  is_liked?: boolean;
}

export default function OtherUserPage() {
  const router = useRouter();
  const { viewUserId } = useLocalSearchParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const loadUserData = useCallback(async () => {
    if (!viewUserId) return;
    
    try {
      setLoading(true);
      console.log('Loading user data for viewUserId:', viewUserId);
      const [userData, currentUserData, followersData, followingData] = await Promise.all([
        getAlumniDetails(Number(viewUserId)),
        getUserInfo(),
        fetchFollowers(Number(viewUserId)),
        fetchFollowing(Number(viewUserId))
      ]);
      
      console.log('User data from API:', userData);
      // Handle the API response structure - it might be wrapped in an 'alumni' property
      const userProfile = userData?.alumni || userData;
      console.log('User profile:', userProfile);
      
      // Add follower/following counts to user profile
      const userWithCounts = {
        ...userProfile,
        followers_count: followersData?.count || 0,
        following_count: followingData?.count || 0
      };
      
      setUser(userWithCounts);
      setCurrentUser(currentUserData);
      
      // Check follow status
      const followStatus = await checkFollowStatus(Number(viewUserId));
      setIsFollowing(followStatus.is_following || false);
      
      // Load user posts
      try {
        const allPosts = await getPosts();
        console.log('All posts:', allPosts);
        // Filter posts by the current user
        const userPosts = allPosts.filter((post: any) => 
          post.user?.user_id === Number(viewUserId) || post.user?.id === Number(viewUserId)
        );
        console.log('User posts:', userPosts);
        setPosts(userPosts);
      } catch (error) {
        console.error('Error loading user posts:', error);
        setPosts([]);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [viewUserId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

  const handleFollow = async () => {
    if (!user || followLoading) return;
    
    try {
      setFollowLoading(true);
      if (isFollowing) {
        const res = await unfollowUser(user.id);
        if (res?.success) {
          setIsFollowing(false);
          // Update follower count - decrease by 1
          setUser(prev => prev ? { ...prev, followers_count: Math.max(0, (prev.followers_count || 0) - 1) } : null);
        }
      } else {
        const res = await followUser(user.id);
        if (res?.success) {
          setIsFollowing(true);
          // Update follower count - increase by 1
          setUser(prev => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : null);
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = () => {
    // Implement messaging functionality
    Alert.alert('Message', 'Messaging feature coming soon!');
  };


  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#174f84" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadUserData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userName = user.name || `${user.f_name || ''} ${user.l_name || ''}`.trim() || 'User';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#174f84"]}
            tintColor="#174f84"
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileImageWrapper}>
            <UserAvatar 
              profilePic={user.profile_pic}
              firstName={user.f_name}
              lastName={user.l_name}
              size={100}
              style={styles.profileImage}
            />
          </View>

          <Text style={styles.profileName}>{userName}</Text>
          <Text style={styles.profileUsername}>@{user.id}</Text>
          
          {user.profile_bio && (
            <Text style={styles.bioText}>{user.profile_bio}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              <Text style={[styles.actionButtonText, isFollowing && styles.followingButtonText]}>
                {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.messageButton]}
              onPress={handleMessage}
            >
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => setShowFollowers(true)}
            >
              <Text style={styles.statNumber}>{user.followers_count ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => setShowFollowing(true)}
            >
              <Text style={styles.statNumber}>{user.following_count ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={styles.postsHeader}>Posts</Text>
          {posts.length === 0 ? (
            <View style={styles.noPostsContainer}>
              <Text style={styles.noPostsText}>No posts yet</Text>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.post_id}
                post={post}
                currentUserId={currentUser?.id}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Followers Modal */}
      <FollowModal
        visible={showFollowers}
        onClose={() => setShowFollowers(false)}
        type="followers"
        userId={user.id}
      />

      {/* Following Modal */}
      <FollowModal
        visible={showFollowing}
        onClose={() => setShowFollowing(false)}
        type="following"
        userId={user.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#174f84',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#174f84',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  profileImageWrapper: {
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#e3ecf7',
  },
  followingButton: {
    backgroundColor: '#174f84',
  },
  messageButton: {
    backgroundColor: '#174f84',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#174f84',
  },
  followingButtonText: {
    color: '#fff',
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postsSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  postsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  noPostsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noPostsText: {
    fontSize: 14,
    color: '#666',
  },
});

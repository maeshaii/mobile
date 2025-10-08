import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl, 
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { 
  API_BASE_URL,
  getAlumniDetails, 
  followUser, 
  unfollowUser, 
  checkFollowStatus,
  getPostsByUserType,
  getUserInfo,
  getPosts,
  getUserPosts,
  fetchFollowers,
  fetchFollowing
} from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import PostCard from '../posts/postCard';
import RepostCard from '../repost/RepostCard';
import FollowModal from '../follow/follow';

interface UserProfile {
  id: number;
  name?: string;
  f_name: string;
  l_name: string;
  profile_pic?: string;
  profile_bio?: string;
  socialMedia?: string;
  email?: string;
  year_graduated?: number;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
}

interface Post {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  post_images?: any[];
  type?: string | null;
  created_at?: string | null;
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  item_type?: 'post';
  user: { 
    user_id: number; 
    f_name: string; 
    l_name: string; 
    profile_pic?: string | null 
  };
}

interface OriginalPost {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id: number;
  };
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  created_at: string;
  is_liked?: boolean;
}

interface FeedRepost {
  repost_id: number;
  created_at: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id?: number;
  };
  caption?: string;
  original_post: OriginalPost;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  item_type: 'repost';
}

type FeedItem = Post | FeedRepost;

// Type guards
const isRepost = (item: FeedItem): item is FeedRepost => {
  return item.item_type === 'repost';
};

const isPost = (item: FeedItem): item is Post => {
  return item.item_type === 'post';
};

export default function OtherUserPage() {
  const router = useRouter();
  const { viewUserId } = useLocalSearchParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  // viewer (likes/reposts)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any | null>(null);

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
      console.log('Followers data from API:', followersData);
      console.log('Following data from API:', followingData);
      
      // Handle the API response structure - it might be wrapped in an 'alumni' property
      const userProfile = userData?.alumni || userData;
      console.log('User profile:', userProfile);
      
      // Add follower/following counts to user profile
      const followersCount = followersData?.count || followersData?.followers?.length || 0;
      const followingCount = followingData?.count || followingData?.following?.length || 0;
      
      console.log('Calculated followers count:', followersCount);
      console.log('Calculated following count:', followingCount);
      
      const userWithCounts = {
        ...userProfile,
        followers_count: followersCount,
        following_count: followingCount,
        socialMedia: userProfile?.social_media || '',
        email: userProfile?.email || ''
      };
      
      console.log('Final user object:', userWithCounts);
      console.log('Final user socialMedia:', userWithCounts.socialMedia);
      console.log('Final user email:', userWithCounts.email);
      console.log('Final user profile_pic:', userWithCounts.profile_pic);
      
      setUser(userWithCounts);
      setCurrentUser(currentUserData);
      
      // Check follow status
      const followStatus = await checkFollowStatus(Number(viewUserId));
      setIsFollowing(followStatus.is_following || false);
      
      // Load user posts
      try {
        const userPostsData = await getUserPosts(Number(viewUserId));
        console.log('User posts data:', userPostsData);
        
        const postsData = userPostsData?.posts || [];
        console.log('Posts data:', postsData);
        
        // Create feed items that include both posts and reposts
        const feedItems: FeedItem[] = [];
        
        // Process posts and reposts from API response
        postsData.forEach((item: any) => {
          if (item.item_type === 'post') {
            // Handle original posts
            const likesArr = Array.isArray(item?.likes) ? item.likes : [];
            const likedByMe = currentUserData?.id ? likesArr.some((l: any) => l?.user_id === currentUserData.id || l?.user?.user_id === currentUserData.id) : false;
            
            feedItems.push({
              ...item,
              created_at: item.created_at || new Date().toISOString(),
              is_liked: !!likedByMe,
              item_type: 'post'
            });
          } else if (item.item_type === 'repost') {
            // Handle reposts
            const repostLikesArr = Array.isArray(item?.likes) ? item.likes : [];
            const repostLikedByMe = currentUserData?.id ? repostLikesArr.some((l: any) => l?.user_id === currentUserData.id || l?.user?.user_id === currentUserData.id) : false;
            
            feedItems.push({
              ...item,
              created_at: item.repost_date || new Date().toISOString(),
              is_liked: !!repostLikedByMe,
              item_type: 'repost'
            });
          }
        });
        
        console.log('User feed items:', feedItems);
        setPosts(feedItems);
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
    // Navigate to chat screen with the user
    if (user?.id) {
      const userName = `${user.f_name || ''} ${user.l_name || ''}`.trim() || 'User';
      router.push(`/messages/chatmessage?conversationId=${user.id}&name=${encodeURIComponent(userName)}`);
    }
  };


  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Other user profile page focused, reloading data...');
      loadUserData();
    }, [loadUserData])
  );

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
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#174f84"]}
            tintColor="#174f84"
          />
        }
      >
      {/* Blue Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

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
          <View style={styles.bioRow}>
            <Text style={styles.bioText}>{user.profile_bio}</Text>
          </View>
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
            <Text style={styles.statLabel}>Followings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Details Card */}
      {(user.socialMedia || user.email) && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Details</Text>
            
            {user.socialMedia && (
              <View style={styles.detailRow}>
                <FontAwesome name="globe" size={16} color="#666" style={styles.detailIcon} />
                <Text style={styles.detailText}>{user.socialMedia}</Text>
              </View>
            )}
            
            {user.email && (
              <View style={styles.detailRow}>
                <FontAwesome name="envelope" size={16} color="#666" style={styles.detailIcon} />
                <Text style={styles.detailText}>{user.email}</Text>
              </View>
            )}
          </View>
        )}

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={styles.postsHeader}>Posts</Text>
          {posts.length === 0 ? (
            <View style={styles.noPostsContainer}>
              <Text style={styles.noPostsText}>No posts yet</Text>
            </View>
          ) : (
            posts.map((item) => {
              if (isRepost(item)) {
                return (
                  <RepostCard
                    key={`otheruser-repost-${item.repost_id}`}
                    repost={item}
                    currentUserId={currentUser?.id}
                    onLikeToggle={(repostId, liked) => {
                      setPosts(prev => prev.map(p => 
                        isRepost(p) && p.repost_id === repostId 
                          ? { ...p, is_liked: liked, likes_count: liked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1) } 
                          : p
                      ));
                    }}
                    onOpenViewer={(repost, type) => {
                      setSelectedPostStats(repost);
                      setViewerType(type);
                      setViewerVisible(true);
                    }}
                    onEdited={(repostId, newCaption) => {
                      setPosts(prev => prev.map(p => 
                        isRepost(p) && p.repost_id === repostId 
                          ? { ...p, caption: newCaption } 
                          : p
                      ));
                    }}
                    onDeleted={(repostId) => {
                      setPosts(prev => prev.filter(p => !(isRepost(p) && p.repost_id === repostId)));
                    }}
                    onOriginalPostReposted={(originalPostId) => {
                      // Update the original post's repost count when it's reposted from a RepostCard
                      setPosts(prev => prev.map(p => {
                        if (isPost(p) && p.post_id === originalPostId) {
                          return {
                            ...p,
                            reposts_count: (p.reposts_count || 0) + 1
                          };
                        }
                        return p;
                      }));
                    }}
                  />
                );
              } else {
                return (
                  <PostCard
                    key={`otheruser-post-${item.post_id}`}
                    post={item}
                    currentUserId={currentUser?.id}
                    onLikeToggle={(postId, isLiked) => {
                      setPosts(prev => prev.map(p => 
                        isPost(p) && p.post_id === postId 
                          ? { ...p, is_liked: isLiked, likes_count: isLiked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1) } 
                          : p
                      ));
                    }}
                    onOpenViewer={(post, type) => {
                      setSelectedPostStats(post);
                      setViewerType(type);
                      setViewerVisible(true);
                    }}
                    onEdited={(postId, newContent) => {
                      setPosts(prev => prev.map(p => 
                        isPost(p) && p.post_id === postId 
                          ? { ...p, post_content: newContent } 
                          : p
                      ));
                    }}
                    onDeleted={(postId) => {
                      setPosts(prev => prev.filter(p => !(isPost(p) && p.post_id === postId)));
                    }}
                    onRepostToggle={(postId, isReposted) => {
                      // Update repost count when a repost is created/deleted
                      setPosts(prev => prev.map(p => {
                        if (isPost(p) && p.post_id === postId) {
                          return {
                            ...p,
                            reposts_count: Math.max(0, (p.reposts_count || 0) + (isReposted ? 1 : -1))
                          };
                        }
                        return p;
                      }));
                    }}
                  />
                );
              }
            })
          )}
        </View>
      </ScrollView>

      {/* Viewer (likes/reposts) */}
      <Modal visible={viewerVisible} transparent animationType="slide" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>{viewerType === 'likes' ? 'Likes' : viewerType === 'comments' ? 'Comments' : 'Reposts'}</Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {viewerType === 'likes' && selectedPostStats?.likes?.map((u: any, idx: number) => (
                <View key={idx} style={styles.listItemRow}>
                  <UserAvatar 
                    profilePic={u.profile_pic}
                    firstName={u.f_name}
                    lastName={u.l_name}
                    size={36}
                    style={styles.listAvatar}
                  />
                  <Text style={styles.listText}>{u.f_name} {u.l_name}</Text>
                </View>
              ))}

              {viewerType === 'reposts' && selectedPostStats?.reposts?.map((r: any) => (
                <View key={r.repost_id} style={styles.listItemRow}>
                  <UserAvatar 
                    profilePic={r.user?.profile_pic}
                    firstName={r.user?.f_name}
                    lastName={r.user?.l_name}
                    size={36}
                    style={styles.listAvatar}
                  />
                  <View>
                    <Text style={styles.listText}>{r.user?.f_name} {r.user?.l_name}</Text>
                    <Text style={styles.listSubText}>{new Date(r.repost_date).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Followers Modal */}
      {user?.id && (
        <FollowModal
          visible={showFollowers}
          onClose={() => setShowFollowers(false)}
          type="followers"
          userId={user.id}
        />
      )}

      {/* Following Modal */}
      {user?.id && (
        <FollowModal
          visible={showFollowing}
          onClose={() => setShowFollowing(false)}
          type="following"
          userId={user.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 0,
  },
  headerContainer: {
    position: 'relative',
  },
  headerBg: {
    height: 160,
    backgroundColor: '#174f84',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 2,
    alignItems: 'center',
    marginTop: -30,
    paddingTop: 60,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    width: '100%',
  },
  profileImageWrapper: {
    position: 'absolute',
    top: -40,
    left: '50%',
    marginLeft: -50,
    zIndex: 2,
    borderWidth: 4,
    borderColor: '#fff',
    borderRadius: 50,
    width: 100,
    height: 100,
    overflow: 'visible',
    backgroundColor: '#eee',
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 50,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#222',
    textAlign: 'center',
  },
  profileUsername: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    textAlign: 'center',
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#444',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    width: '100%',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    marginRight: 12,
    width: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
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
    paddingTop: 20,
  },
  postsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  noPostsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noPostsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
    color: '#174f84',
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
  // Viewer modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ef',
    marginRight: 10,
  },
  listText: {
    fontSize: 14,
    color: '#1e3a8a',
    fontWeight: '600',
  },
  listSubText: {
    fontSize: 12,
    color: '#888',
  },
});

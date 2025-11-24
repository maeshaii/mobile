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
  Modal,
  Linking,
  Image
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { 
  API_BASE_URL,
  getAlumniDetails, 
  getOJTUserDetails,
  followUser, 
  unfollowUser, 
  checkFollowStatus,
  getPostsByUserType,
  getUserInfo,
  getPosts,
  getUserPosts,
  fetchFollowers,
  fetchFollowing,
  getAdminPesoUsers,
  getPostLikes,
  getPostReposts
} from '../../services/api';
import FollowModal from '../follow/follow';
import UserAvatar from '../../components/UserAvatar';
import PostCard from '../posts/postCard';
import RepostCard from '../repost/RepostCard';
import { formatUserFullName } from '../../utils/nameUtils';
import PhotoGalleryModal from '../../components/PhotoGalleryModal';

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
  account_type?: {
    admin?: boolean;
    peso?: boolean;
    ccict?: boolean;
    ojt?: boolean;
  };
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
  post_images?: any[];
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
  const [isSpecialAccount, setIsSpecialAccount] = useState(false);

  // viewer (likes/reposts)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any | null>(null);

  // photo gallery
  const [showAllPhotosModal, setShowAllPhotosModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const loadUserData = useCallback(async () => {
    if (!viewUserId) return;
    
    try {
      setLoading(true);
      console.log('Loading user data for viewUserId:', viewUserId);
      
      // Try to get user data - first try alumni, then OJT
      let userData: any = null;
      let isOJTUser = false;
      
      try {
        const alumniResponse = await getAlumniDetails(Number(viewUserId));
        console.log('Alumni response:', alumniResponse);
        
        // Check if response indicates success and has data
        // Alumni endpoint returns {success: True, alumni: {...}} or {success: False, message: '...'} with 404
        if (alumniResponse && alumniResponse.success !== false && (alumniResponse.alumni || alumniResponse.id || alumniResponse.user_id)) {
          // Check if this is actually an OJT user (alumni endpoint might return OJT users too)
          const userProfile = alumniResponse.alumni || alumniResponse;
          const accountType = userProfile?.account_type;
          const isOJTAccount = accountType?.ojt || userProfile?.account_type?.ojt;
          
          if (isOJTAccount) {
            // If it's an OJT user, try to get full OJT details instead
            console.log('User is OJT, fetching OJT details');
            throw new Error('User is OJT, need OJT endpoint');
          }
          
          userData = alumniResponse;
          console.log('Using alumni data');
        } else {
          // Response exists but indicates failure, try OJT
          throw new Error('Alumni user not found in response');
        }
      } catch (alumniError: any) {
        console.log('Alumni endpoint failed, trying OJT endpoint. Error status:', alumniError?.response?.status, 'Error message:', alumniError?.message);
        console.log('Alumni error response data:', alumniError?.response?.data);
        
        // If alumni endpoint fails (any error), try OJT endpoint
        try {
          const ojtResponse = await getOJTUserDetails(Number(viewUserId));
          console.log('OJT response:', ojtResponse);
          
          // Backend returns { success: True, user: {...} }
          if (ojtResponse?.success === false) {
            throw new Error('OJT endpoint returned success: false');
          }
          
          const ojtUser = ojtResponse?.user || ojtResponse;
          console.log('OJT user data:', ojtUser);
          
          // Transform OJT data to match alumni format
          if (ojtUser && (ojtUser.CTU_ID || ojtUser.user_id || ojtUser.First_Name || ojtUser.Last_Name)) {
            isOJTUser = true;
            userData = {
              id: ojtUser.CTU_ID || ojtUser.user_id || Number(viewUserId),
              user_id: ojtUser.CTU_ID || ojtUser.user_id || Number(viewUserId),
              name: formatUserFullName({
                f_name: ojtUser.First_Name || '',
                m_name: ojtUser.Middle_Name || '',
                l_name: ojtUser.Last_Name || ''
              }) || 'OJT User',
              f_name: ojtUser.First_Name || '',
              m_name: ojtUser.Middle_Name || '',
              l_name: ojtUser.Last_Name || '',
              profile_pic: ojtUser.Profile_Picture || null,
              profile_bio: ojtUser.Bio || ojtUser.profile_bio || '',
              social_media: ojtUser.Social_Media || '',
              email: ojtUser.Email || '',
              year_graduated: ojtUser.Year_Graduated || null,
              course: ojtUser.Course || '',
              ojt_status: ojtUser.Status || null,
            };
            console.log('Transformed OJT user data:', userData);
          } else {
            throw new Error('OJT user data not found in response');
          }
        } catch (ojtError: any) {
          console.error('Both alumni and OJT endpoints failed');
          console.error('OJT error status:', ojtError?.response?.status);
          console.error('OJT error data:', ojtError?.response?.data);
          console.error('OJT error message:', ojtError?.message);
          Alert.alert('Error', 'User not found');
          setLoading(false);
          return;
        }
      }
      
      // If userData is still null, show error
      if (!userData) {
        console.error('userData is null after trying both endpoints');
        Alert.alert('Error', 'User not found');
        setLoading(false);
        return;
      }
      
      const [currentUserData, followersData, followingData, specialUsers] = await Promise.all([
        getUserInfo(),
        fetchFollowers(Number(viewUserId)).catch(() => ({ followers: [], count: 0 })),
        fetchFollowing(Number(viewUserId)).catch(() => ({ following: [], count: 0 })),
        getAdminPesoUsers().catch(() => ({ admin_user_ids: [], peso_user_ids: [] }))
      ]);
      
      // Check if viewing own profile and redirect to profile page
      const currentUserId = currentUserData?.user_id || currentUserData?.id;
      if (currentUserId && Number(viewUserId) === Number(currentUserId)) {
        router.replace('/profile/profilepage');
        setLoading(false);
        return;
      }
      
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
      try {
        const adminIds: number[] = Array.isArray(specialUsers?.admin_user_ids) ? specialUsers.admin_user_ids : [];
        const pesoIds: number[] = Array.isArray(specialUsers?.peso_user_ids) ? specialUsers.peso_user_ids : [];
        const viewedId = Number(viewUserId);
        setIsSpecialAccount(adminIds.includes(viewedId) || pesoIds.includes(viewedId));
      } catch {}
      
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
      const userName = formatUserFullName(user);
      router.push(`/messages/chatmessage?conversationId=${user.id}&name=${encodeURIComponent(userName)}`);
    }
  };

  // Extract all images from posts
  const getAllPostImages = (): string[] => {
    const allImages: string[] = [];
    
    posts.forEach((item) => {
      if (isPost(item)) {
        // Handle multiple images
        if (item.post_images && item.post_images.length > 0) {
          const sortedImages = [...item.post_images].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          sortedImages.forEach((img: any) => {
            if (img.image_url && !allImages.includes(img.image_url)) {
              allImages.push(img.image_url);
            }
          });
        }
        // Handle single image (backward compatibility)
        else if (item.post_image && !allImages.includes(item.post_image)) {
          allImages.push(item.post_image);
        }
      } else if (isRepost(item)) {
        // Handle repost original post images
        const originalPost = item.original_post;
        if (originalPost.post_images && originalPost.post_images.length > 0) {
          const sortedImages = [...originalPost.post_images].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          sortedImages.forEach((img: any) => {
            if (img.image_url && !allImages.includes(img.image_url)) {
              allImages.push(img.image_url);
            }
          });
        } else if (originalPost.post_image && !allImages.includes(originalPost.post_image)) {
          allImages.push(originalPost.post_image);
        }
      }
    });
    
    return allImages;
  };

  const allPostImages = getAllPostImages();
  const displayPhotos = allPostImages.slice(0, 9); // Show first 9 photos

  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/media/')) {
      return `${API_BASE_URL}${url}`;
    }
    return `${API_BASE_URL}${url}`;
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

  const userName = user.name || formatUserFullName(user);

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
        
        <View style={styles.bioRow}>
          {user.profile_bio && user.profile_bio.trim() ? (
            <Text style={styles.bioText}>{user.profile_bio}</Text>
          ) : (
            <Text style={styles.bioText}>This user has not added a bio yet.</Text>
          )}
        </View>

      

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {!isSpecialAccount && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              <Text style={[styles.actionButtonText, isFollowing && styles.followingButtonText]}>
                {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.messageButton]}
            onPress={handleMessage}
          >
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {!isSpecialAccount && (
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
        )}
      </View>

      {/* Details Card */}
      {(user.socialMedia || user.email) && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Details</Text>
            
            {user.socialMedia && (
              <TouchableOpacity 
                style={styles.detailRow}
                onPress={async () => {
                  try {
                    let url = user.socialMedia || '';
                    // Add protocol if missing
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      url = 'https://' + url;
                    }
                    const canOpen = await Linking.canOpenURL(url);
                    if (canOpen) {
                      await Linking.openURL(url);
                    } else {
                      Alert.alert('Error', 'Cannot open this URL');
                    }
                  } catch (error) {
                    console.error('Error opening social media URL:', error);
                    Alert.alert('Error', 'Failed to open link');
                  }
                }}
                activeOpacity={0.7}
              >
                <FontAwesome name="globe" size={16} color="#666" style={styles.detailIcon} />
                <Text style={[styles.detailText, styles.clickableText]}>{user.socialMedia}</Text>
              </TouchableOpacity>
            )}
            
            {user.email && (
              <TouchableOpacity 
                style={styles.detailRow}
                onPress={async () => {
                  try {
                    const emailUrl = `mailto:${user.email}`;
                    const canOpen = await Linking.canOpenURL(emailUrl);
                    if (canOpen) {
                      await Linking.openURL(emailUrl);
                    } else {
                      Alert.alert('Error', 'Cannot open email client');
                    }
                  } catch (error) {
                    console.error('Error opening email:', error);
                    Alert.alert('Error', 'Failed to open email');
                  }
                }}
                activeOpacity={0.7}
              >
                <FontAwesome name="envelope" size={16} color="#666" style={styles.detailIcon} />
                <Text style={[styles.detailText, styles.clickableText]}>{user.email}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Photos Section */}
        {allPostImages.length > 0 && (
          <View style={styles.photosCard}>
            <View style={styles.photosHeader}>
              <Text style={styles.photosTitle}>Photos ({allPostImages.length})</Text>
              {allPostImages.length > 9 && (
                <TouchableOpacity
                  onPress={() => {
                    setCurrentPhotoIndex(0);
                    setShowAllPhotosModal(true);
                  }}
                >
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.photosGrid}>
              {displayPhotos.map((imageUrl, index) => {
                const isLastPhoto = index === displayPhotos.length - 1;
                const hasMorePhotos = allPostImages.length > 9;
                const remainingPhotos = allPostImages.length - 9;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoItem}
                    onPress={() => {
                      const clickedIndex = allPostImages.indexOf(imageUrl);
                      setCurrentPhotoIndex(clickedIndex);
                      setShowAllPhotosModal(true);
                    }}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: getImageUrl(imageUrl) }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    {isLastPhoto && hasMorePhotos && (
                      <View style={styles.photoOverlay}>
                        <Text style={styles.photoOverlayText}>+{remainingPhotos} photos</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={styles.postsHeader}>Posts</Text>
          {posts.length === 0 ? (
            <View style={styles.noPostsContainer}>
              <Text style={styles.noPostsText}>
                {(isSpecialAccount || 
                  user?.account_type?.admin || 
                  user?.account_type?.peso || 
                  user?.account_type?.ccict ||
                  userName?.toLowerCase().includes('admin') || 
                  userName?.toLowerCase().includes('peso'))
                  ? "This user has not posted anything yet."
                  : (isFollowing
                      ? "This user has not posted anything yet."
                      : "Follow this user to view their posts")}
              </Text>
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
                    onOpenViewer={async (post, type) => {
                      try {
                        setSelectedPostStats(post);
                        setViewerType(type);
                        setViewerVisible(true);

                        // Fetch fresh data for the viewer
                        if (type === 'likes') {
                          const likesData = await getPostLikes(post.post_id);
                          setSelectedPostStats((prev: any) => prev ? { ...prev, likes: likesData || [] } : null);
                        } else if (type === 'reposts') {
                          const repostsData = await getPostReposts(post.post_id);
                          setSelectedPostStats((prev: any) => prev ? { ...prev, reposts: repostsData || [] } : null);
                        }
                      } catch (error) {
                        console.error('Error fetching viewer data:', error);
                        // Still show the viewer even if fetch fails
                      }
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
          {(() => {
            // Calculate the number of items to determine modal height
            let itemCount = 0;
            if (viewerType === 'likes') {
              itemCount = selectedPostStats?.likes?.length || 0;
            } else if (viewerType === 'reposts') {
              itemCount = selectedPostStats?.reposts?.length || 0;
            } else if (viewerType === 'comments') {
              itemCount = selectedPostStats?.comments?.length || 0;
            }
            
            // Calculate dynamic height: header (60px) + items (70px each) + padding (32px)
            const headerHeight = 60;
            const itemHeight = 70;
            const padding = 32;
            const calculatedHeight = headerHeight + (itemCount * itemHeight) + padding;
            const maxHeight = 600; // Cap at 600px
            const minHeight = headerHeight + padding + 20; // Minimum for header
            const modalHeight = Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
            const shouldScroll = itemCount > 8;
            
            return (
              <View style={[styles.viewerModal, { maxHeight: modalHeight }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.modalTitle}>{viewerType === 'likes' ? 'Likes' : viewerType === 'comments' ? 'Comments' : 'Reposts'}</Text>
                  <TouchableOpacity onPress={() => setViewerVisible(false)}>
                    <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  style={{ maxHeight: shouldScroll ? 500 : undefined }}
                  contentContainerStyle={shouldScroll ? {} : { paddingBottom: 0 }}
                  showsVerticalScrollIndicator={shouldScroll}
                  nestedScrollEnabled={true}
                >
              {viewerType === 'likes' && selectedPostStats?.likes?.map((u: any, idx: number) => {
                const userId = u.user_id || u.id;
                const currentUserId = currentUser?.user_id || currentUser?.id;
                const isCurrentUser = userId && currentUserId && userId === currentUserId;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.listItemRow}
                    onPress={() => {
                      if (userId) {
                        setViewerVisible(false);
                        if (isCurrentUser) {
                          router.push('/profile/profilepage');
                        } else {
                          router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                        }
                      }
                    }}
                    disabled={!userId}
                  >
                    <UserAvatar 
                      profilePic={u.profile_pic}
                      firstName={u.f_name}
                      lastName={u.l_name}
                      size={36}
                      style={styles.listAvatar}
                    />
                    <Text style={[styles.listText, userId && { color: '#1e3a8a' }]}>{formatUserFullName(u)}</Text>
                  </TouchableOpacity>
                );
              })}

              {viewerType === 'reposts' && selectedPostStats?.reposts?.map((r: any) => {
                const userId = r.user?.user_id || r.user?.id;
                const currentUserId = currentUser?.user_id || currentUser?.id;
                const isCurrentUser = userId && currentUserId && userId === currentUserId;
                return (
                  <TouchableOpacity
                    key={r.repost_id}
                    style={styles.listItemRow}
                    onPress={() => {
                      if (userId) {
                        setViewerVisible(false);
                        if (isCurrentUser) {
                          router.push('/profile/profilepage');
                        } else {
                          router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                        }
                      }
                    }}
                    disabled={!userId}
                  >
                    <UserAvatar 
                      profilePic={r.user?.profile_pic}
                      firstName={r.user?.f_name}
                      lastName={r.user?.l_name}
                      size={36}
                      style={styles.listAvatar}
                    />
                    <Text style={[styles.listText, userId && { color: '#1e3a8a' }]}>{formatUserFullName(r.user)}</Text>
                  </TouchableOpacity>
                );
              })}
                </ScrollView>
              </View>
            );
          })()}
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

      {/* Photo Gallery Modal */}
      {showAllPhotosModal && allPostImages.length > 0 && (
        <PhotoGalleryModal
          isOpen={showAllPhotosModal}
          onClose={() => setShowAllPhotosModal(false)}
          images={allPostImages.map(url => getImageUrl(url))}
          currentIndex={currentPhotoIndex}
          onPrevious={() => {
            setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : allPostImages.length - 1));
          }}
          onNext={() => {
            setCurrentPhotoIndex(prev => (prev < allPostImages.length - 1 ? prev + 1 : 0));
          }}
          onImageClick={(index) => setCurrentPhotoIndex(index)}
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
  clickableText: {
    color: '#174f84',
    textDecorationLine: 'underline',
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
    alignSelf: 'center',
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
  photosCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#174f84',
    fontWeight: '500',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  photoItem: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

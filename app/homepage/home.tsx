import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackerReminderModal from '../../components/TrackerReminderModal';
import NavBar from '../(tabs)/navbar';
import { API_BASE_URL, commentOnPost, getPosts, getUserInfo, likePost, logoutUser, repostPost, unlikePost, getPostDetail, editPost, getPostLikes, getFeed } from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import PostCard from '../posts/postCard';
import RepostCard from '../repost/RepostCard';
import DonationPostCard from '../donation/DonationPostCard';
import { useFocusEffect } from '@react-navigation/native';
import UserAvatar from '../../components/UserAvatar';
import PeopleYouMayKnowCard from '../peopleyoumayknow/PeopleYouMayKnowCard';
import { NotificationWebSocket } from '../../services/notificationWebSocket';
import { formatUserFullName } from '../../utils/nameUtils';

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
  caption?: string;
  created_at: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id?: number;
  };
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
  return item.item_type === 'post' || !('repost_id' in item);
};

interface UserInfo {
  user_id?: number;
  name?: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
  course?: string;
  year_graduated?: number;
}

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({ name: '', course: '', year_graduated: '', profile_pic: '' });
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [viewPostId, setViewPostId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPostActionSheet, setShowPostActionSheet] = useState(false);
  const [postActionForId, setPostActionForId] = useState<number | null>(null);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState<string>('');
  const [actionLoadingPostId, setActionLoadingPostId] = useState<number | null>(null);
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [modalPostId, setModalPostId] = useState<number | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const [nowTick, setNowTick] = useState(0);
  const [showTrackerReminder, setShowTrackerReminder] = useState<boolean>(false);

  useEffect(() => {
    loadUserInfo();
    loadPosts();
    // Tick every minute to update relative timestamps
    const t = setInterval(() => setNowTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Setup WebSocket for real-time points updates
  useEffect(() => {
    let notificationWs: NotificationWebSocket | null = null;

    const setupWebSocket = async () => {
      try {
        const user = await getUserInfo();
        const userId = user?.user_id || user?.id;
        if (!userId) return;

        const { getAccessToken } = await import('../../services/api');
        const token = await getAccessToken();

        notificationWs = new NotificationWebSocket(userId, API_BASE_URL, token);

        notificationWs.onNotification((event) => {
          console.log('HomePage NotificationWebSocket: Received event:', event.type, event);
          if (event.type === 'points_update' && event.points) {
            const pointsData = event.points;
            console.log('HomePage NotificationWebSocket: Points update received:', pointsData);
            // Points update is handled - the backend broadcasts to all connected clients
            // The rewards screen will receive it directly via its own WebSocket connection
          }
        });

        notificationWs.onStatus((status) => {
          console.log('HomePage Notification WebSocket status:', status);
        });

        await notificationWs.connect();
      } catch (error) {
        console.error('HomePage: Failed to setup notification WebSocket:', error);
      }
    };

    setupWebSocket();

    return () => {
      if (notificationWs) {
        notificationWs.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if ((params as any)?.trackerReminder === '1') {
      setShowTrackerReminder(true);
    }
  }, [(params as any)?.trackerReminder]);

  // Refetch posts whenever this screen gains focus (e.g., after creating a post)
  useFocusEffect(
    React.useCallback(() => {
      loadPosts();
    }, [])
  );

  // Add refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPosts();
    } finally {
      setRefreshing(false);
    }
  };

  // Helper function to render posts with People You May Know section
  const renderPostsWithSuggestions = () => {
    const elements: React.ReactNode[] = [];
    
    posts.forEach((item, index) => {
      // Add People You May Know after the first 2 posts
      if (index === 2) {
        elements.push(
          <View key="people-you-may-know">
            <PeopleYouMayKnowCard />
          </View>
        );
      }
      
      // Add the actual post
      if (item.item_type === 'repost') {
        elements.push(
          <RepostCard
            key={`home-repost-${item.repost_id}`}
            repost={item}
            currentUserId={user?.user_id || (user as any)?.id}
            onLikeToggle={(repostId, liked) => {
              setPosts((prev) => prev.map((p) => {
                if (isRepost(p) && p.repost_id === repostId) {
                  return {
                    ...p,
                    is_liked: liked,
                    likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)),
                  } as FeedRepost;
                }
                return p;
              }));
            }}
            onOpenViewer={(repost, type) => {
              setSelectedPost({...repost, item_type: 'repost'} as FeedRepost);
              setViewerType(type);
              setViewerVisible(true);
            }}
            onEdited={(repostId, newCaption) => {
              setPosts(prev => prev.map(p => {
                if (isRepost(p) && p.repost_id === repostId) {
                  return { ...p, caption: newCaption };
                }
                return p;
              }));
            }}
            onDeleted={(repostId) => {
              setPosts(prev => prev.filter(p => !isRepost(p) || p.repost_id !== repostId));
            }}
            onOriginalPostReposted={(originalPostId) => {
              setPosts(prev => prev.map(p => {
                if (isPost(p) && p.post_id === originalPostId) {
                  return {
                    ...p,
                    reposts_count: (p.reposts_count || 0) + 1
                  } as any;
                }
                return p;
              }));
            }}
          />
        );
      } else if (item.type === 'donation') {
        elements.push(
          <DonationPostCard
            key={`home-donation-${item.post_id}`}
            post={item}
            currentUserId={user?.user_id || (user as any)?.id}
            onLikeToggle={(postId, liked) => {
              setPosts((prev) => prev.map((p) => {
                if (isPost(p) && p.post_id === postId) {
                  return {
                    ...p,
                    is_liked: liked,
                    likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)),
                  } as any;
                }
                return p;
              }));
            }}
            onOpenViewer={(post, type) => {
              setSelectedPost(post);
              setViewerType(type);
              setViewerVisible(true);
            }}
            onEdited={(postId, newContent) => {
              setPosts(prev => prev.map(p => {
                if (isPost(p) && p.post_id === postId) {
                  return { ...p, post_content: newContent };
                }
                return p;
              }));
            }}
            onDeleted={(postId) => {
              setPosts(prev => prev.filter(p => !isPost(p) || p.post_id !== postId));
            }}
            onRepostToggle={(postId, reposted) => {
              setPosts(prev => prev.map(p => {
                if (isPost(p) && p.post_id === postId) {
                  return {
                    ...p,
                    reposts_count: Math.max(0, (p.reposts_count || 0) + (reposted ? 1 : -1))
                  } as any;
                }
                return p;
              }));
            }}
          />
        );
      } else {
        elements.push(
          <PostCard
            key={`home-post-${item.post_id}`}
            post={item}
            currentUserId={user?.user_id || (user as any)?.id}
            onLikeToggle={(postId, liked) => {
              setPosts((prev) => prev.map((p) => {
                if (isPost(p) && p.post_id === postId) {
                  return {
                    ...p,
                    is_liked: liked,
                    likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)),
                  } as any;
                }
                return p;
              }));
            }}
            onOpenViewer={(post, type) => {
              setSelectedPost(post);
              setViewerType(type);
              setViewerVisible(true);
            }}
            onEdited={(postId, newContent) => {
              setPosts(prev => prev.map(p => {
                if (isPost(p) && p.post_id === postId) {
                  return { ...p, post_content: newContent };
                }
                return p;
              }));
            }}
            onDeleted={(postId) => {
              setPosts(prev => prev.filter(p => !isPost(p) || p.post_id !== postId));
            }}
            onRepostToggle={(postId, reposted) => {
              setPosts(prev => prev.map(p => {
                if (isPost(p) && p.post_id === postId) {
                  return {
                    ...p,
                    reposts_count: Math.max(0, (p.reposts_count || 0) + (reposted ? 1 : -1))
                  } as any;
                }
                return p;
              }));
            }}
          />
        );
      }
    });
    
    return elements;
  };

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      const userInfo = await getUserInfo();
      console.log('🔍 HOME DEBUG: User info loaded:', userInfo);
      
      if (userInfo) {
        setUser(userInfo);
        setEditData({
          name: userInfo.name || '',
          course: userInfo.course || '',
          year_graduated: userInfo.year_graduated ? String(userInfo.year_graduated) : '',
          profile_pic: userInfo.profile_pic || '',
        });
      } else {
        console.log('🔍 HOME DEBUG: No user info, checking localStorage...');
        // Check localStorage as fallback for OJT users
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const localUser = JSON.parse(userStr);
          console.log('🔍 HOME DEBUG: Found user in localStorage:', localUser);
          setUser(localUser);
          setEditData({
            name: localUser.name || '',
            course: localUser.course || '',
            year_graduated: localUser.year_graduated ? String(localUser.year_graduated) : '',
            profile_pic: localUser.profile_pic || '',
          });
        } else {
          console.log('🔍 HOME DEBUG: No user found, redirecting to login');
          router.replace('/login/login');
        }
      }
    } catch (err) {
      console.error('🔍 HOME DEBUG: Error loading user info:', err);
      // Try localStorage as fallback for OJT users
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const localUser = JSON.parse(userStr);
          console.log('🔍 HOME DEBUG: Using localStorage fallback:', localUser);
          setUser(localUser);
          setEditData({
            name: localUser.name || '',
            course: localUser.course || '',
            year_graduated: localUser.year_graduated ? String(localUser.year_graduated) : '',
            profile_pic: localUser.profile_pic || '',
          });
        } else {
          setError('Failed to load user information');
          console.error('Error loading user info:', err);
        }
      } catch (localErr) {
        setError('Failed to load user information');
        console.error('Error loading user info:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      setPostsLoading(true);
      const postsData = await getFeed();
      console.log('Homepage posts data:', postsData); // Debug log
      const me: any = await getUserInfo();
      const meId = me?.user_id || me?.id;
      let likedRepostsSet = new Set<number>();
      try {
        const raw = await AsyncStorage.getItem('likedReposts');
        likedRepostsSet = new Set<number>(raw ? JSON.parse(raw) : []);
      } catch {}
      
      // The backend returns a flat array of feed items (posts and reposts)
      const feedItems: any[] = [];
      
      (Array.isArray(postsData) ? postsData : [])
        .filter((item: any) => item.type !== 'forum') // Exclude forum posts from home feed
        .forEach((item: any) => {
          if (item.item_type === 'repost') {
            // Handle reposts - prioritize backend is_liked field
            let repostLikedByMe = item.is_liked !== undefined ? item.is_liked : false;
            if (repostLikedByMe === false && meId) {
              // Fallback: check likes array if is_liked not provided
              const repostLikesArr = Array.isArray(item?.likes) ? item.likes : [];
              repostLikedByMe = repostLikesArr.some((l: any) => l?.user_id === meId || l?.user?.user_id === meId);
            }
            // Also check local storage as final fallback
            if (!repostLikedByMe) {
              repostLikedByMe = likedRepostsSet.has(item.repost_id);
            }
            
            feedItems.push({
              ...item,
              is_liked: !!repostLikedByMe,
              item_type: 'repost'
            });
          } else {
            // Handle original posts - prioritize backend is_liked field
            let likedByMe = item.is_liked !== undefined ? item.is_liked : false;
            if (likedByMe === false && meId) {
              // Fallback: check likes array if is_liked not provided
              const likesArr = Array.isArray(item?.likes) ? item.likes : [];
              likedByMe = likesArr.some((l: any) => l?.user_id === meId || l?.user?.user_id === meId);
            }
            
            feedItems.push({
              ...item,
              is_liked: !!likedByMe,
              item_type: 'post'
            });
          }
        });
      
      // Sort feed items by date
      const sortedFeed = feedItems.sort((a, b) => 
        new Date(b.created_at || b.repost_date).getTime() - 
        new Date(a.created_at || a.repost_date).getTime()
      );
      
      console.log('Combined feed items:', sortedFeed.length); // Debug log
      console.log('Feed breakdown:', {
        posts: sortedFeed.filter(item => item.item_type === 'post').length,
        reposts: sortedFeed.filter(item => item.item_type === 'repost').length
      }); // Debug log
      
      setPosts(sortedFeed);
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleLikePost = async (postId: number, isLiked: boolean) => {
    if (actionLoadingPostId === postId) return; // prevent duplicate taps
    setActionLoadingPostId(postId);
    try {
      // Optimistic UI update
      setPosts((prev) => prev.map((p) => {
        if (isPost(p) && p.post_id !== postId) return p;
        if (isRepost(p)) return p; // Don't update reposts when liking original posts
        const nextLiked = !isLiked;
        const nextCount = Math.max(0, (p.likes_count || 0) + (nextLiked ? 1 : -1));
        return { ...p, is_liked: nextLiked, likes_count: nextCount } as Post;
      }));

      if (isLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }

      // Re-fetch single post detail to ensure counts and lists are accurate
      try {
        const detail = await getPostDetail(postId);
        const me: any = await getUserInfo();
        const meId = me?.user_id || me?.id;
        const likesArr = Array.isArray(detail?.likes) ? detail.likes : [];
        const likedByMe = meId ? likesArr.some((l: any) => l?.user_id === meId || l?.user?.user_id === meId) : false;
        setPosts((prev) => prev.map((p) => {
          if (isPost(p) && p.post_id === postId) {
            return {
              ...p,
              likes: likesArr,
              comments: Array.isArray(detail?.comments) ? detail.comments : p.comments,
              reposts: Array.isArray(detail?.reposts) ? detail.reposts : p.reposts,
              likes_count: detail?.likes_count ?? likesArr.length ?? p.likes_count,
              comments_count: detail?.comments_count ?? p.comments_count,
              reposts_count: detail?.reposts_count ?? p.reposts_count,
              is_liked: !!likedByMe,
            } as Post;
          }
          return p;
        }));
      } catch (e) {
        // Non-fatal; keep optimistic state
      }
    } catch (error) {
      // Revert on failure
      setPosts((prev) => prev.map((p) => {
        if (isPost(p) && p.post_id === postId) {
          const revertedLiked = isLiked;
          const revertedCount = Math.max(0, (p.likes_count || 0) + (isLiked ? 1 : -1));
          return { ...p, is_liked: revertedLiked, likes_count: revertedCount } as Post;
        }
        return p;
      }));
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setActionLoadingPostId(null);
    }
  };

  const handleRepost = async (postId: number) => {
    try {
      await repostPost(postId);
      Alert.alert('Success', 'Post reposted successfully!');
      // Refresh posts to get updated repost status
      await loadPosts();
    } catch (error) {
      console.error('Error reposting:', error);
      Alert.alert('Error', 'Failed to repost. You may have already reposted this.');
    }
  };

  const handleComment = async (postId: number) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  };

  const submitComment = async () => {
    if (!selectedPostId || !commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      await commentOnPost(selectedPostId, commentText.trim());
      setCommentText('');
      setCommentModalVisible(false);
      setSelectedPostId(null);
      Alert.alert('Success', 'Comment added successfully!');
      // Refresh posts to get updated comment count
      await loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
              router.replace('/login/login');
            } catch (err) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
              console.error('Logout error:', err);
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    setEditModalVisible(true);
  };

  const handleSaveProfile = () => {
    if (user) {
      setUser({ 
        ...user, 
        name: editData.name,
        course: editData.course,
        year_graduated: editData.year_graduated ? parseInt(editData.year_graduated) : undefined,
        profile_pic: editData.profile_pic
      });
    }
    setEditModalVisible(false);
    Alert.alert('Profile updated (not saved to backend)');
  };

  // nowTick triggers re-render for live relative time; no direct usage

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadUserInfo}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar />
      {/* Header with logout button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Home</Text>
      </View>


      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1e3a8a']}
            tintColor="#1e3a8a"
          />
        }
      >
      {/* Start a Post */}
      <View style={styles.postCard}>
        <View style={styles.postRow}>
          <UserAvatar 
            profilePic={user?.profile_pic}
            firstName={user?.f_name}
            lastName={user?.l_name}
            size={40}
            style={styles.avatar}
          />
            <TouchableOpacity
              style={styles.startPostInputWrapper}
              onPress={() => router.push('/posts/post')}
              activeOpacity={0.8}
            >
              <Text style={styles.startPostText}>Start a post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts Feed */}
        {postsLoading ? (
          <View style={styles.postsLoadingContainer}>
            <ActivityIndicator size="large" color="#1e3a8a" />
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.noPostsContainer}>
            <Text style={styles.noPostsText}>No posts yet. Start following users or create your first post.</Text>
            <Text style={styles.pullToRefreshText}>Pull down to refresh</Text>
          </View>
        ) : (
          <>
            {renderPostsWithSuggestions()}
          </>
        )}

        {/* Comment Modal */}
        <Modal visible={commentModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TextInput
                style={styles.modalInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write your comment..."
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#1e3a8a' }]}
                  onPress={submitComment}
                >
                  <Text style={{ color: '#fff' }}>Post Comment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#eee' }]}
                  onPress={() => {
                    setCommentModalVisible(false);
                    setCommentText('');
                    setSelectedPostId(null);
                  }}
                >
                  <Text style={{ color: '#1e3a8a' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Post Modal - stylized header and body */}
        <Modal visible={editingPostId != null} transparent animationType="slide" onRequestClose={() => setEditingPostId(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.viewerModal, { paddingTop: 0 }] }>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
                <TouchableOpacity onPress={() => setEditingPostId(null)} style={{ padding: 6 }}>
                  <FontAwesome name="close" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { marginBottom: 0 }]}>EDIT POST</Text>
                <TouchableOpacity
                  onPress={async () => {
                    if (editingPostId == null) return;
                    try {
                      await editPost(editingPostId, { post_content: (editPostContent || '').trim() });
                      setEditingPostId(null);
                      setEditPostContent('');
                      await loadPosts();
                    } catch (e) {
                      Alert.alert('Error', 'Failed to save changes');
                    }
                  }}
                >
                  <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>SAVE</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.modalInput, { minHeight: 160 }]}
                value={editPostContent}
                onChangeText={setEditPostContent}
                placeholder="Update your post..."
                multiline
              />
            </View>
          </View>
        </Modal>

        {/* Viewer Modal */}
        <Modal
          visible={viewerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setViewerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.viewerModal}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.modalTitle}>
                  {viewerType === 'likes' ? 'Likes' : viewerType === 'comments' ? 'Comments' : 'Reposts'}
                </Text>
                <TouchableOpacity onPress={() => setViewerVisible(false)}>
                  <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                {viewerType === 'likes' && selectedPost && isPost(selectedPost) && selectedPost.likes?.map((u: any, idx: number) => (
                  <View key={idx} style={styles.listItemRow}>
                    <UserAvatar 
                      profilePic={u.profile_pic}
                      firstName={u.f_name}
                      lastName={u.l_name}
                      size={32}
                      style={styles.listAvatar}
                    />
                    <Text style={styles.listText}>{formatUserFullName(u)}</Text>
                  </View>
                ))}

                {viewerType === 'reposts' && selectedPost && isPost(selectedPost) && selectedPost.reposts?.map((r: any) => (
                  <View key={r.repost_id} style={styles.listItemRow}>
                    <UserAvatar 
                      profilePic={r.user?.profile_pic}
                      firstName={r.user?.f_name}
                      lastName={r.user?.l_name}
                      size={32}
                      style={styles.listAvatar}
                    />
                    <View>
                      <Text style={styles.listText}>{formatUserFullName(r.user)}</Text>
                      <Text style={styles.listSubText}>{new Date(r.repost_date).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}

                {viewerType === 'comments' && selectedPost && isPost(selectedPost) && selectedPost.comments?.map((c: any) => (
                  <View key={c.comment_id} style={styles.commentRow}>
                    <UserAvatar 
                      profilePic={c.user?.profile_pic}
                      firstName={c.user?.f_name}
                      lastName={c.user?.l_name}
                      size={32}
                      style={styles.commentAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.commentHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commentName}>{formatUserFullName(c.user)}</Text>
                          <Text style={styles.commentMeta}>{new Date(c.date_created).toLocaleString()}</Text>
                        </View>
                      </View>
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentBody}>{c.comment_content}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {viewerType === 'comments' && selectedPost ? (
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    value={commentText}
                    onChangeText={setCommentText}
                  />
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={async () => {
                      const message = (commentText || '').trim();
                      if (!message) return;
                      try {
                        if (selectedPost && isPost(selectedPost)) {
                          await commentOnPost(selectedPost.post_id, message);
                          setCommentText('');
                          setViewerVisible(false);
                          await loadPosts(); // Refresh posts
                        }
                      } catch (e) {
                        Alert.alert('Error', 'Failed to add comment');
                      }
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Send</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      </ScrollView>
      {/* Tracker reminder modal */}
      <TrackerReminderModal
        isVisible={showTrackerReminder}
        onClose={() => setShowTrackerReminder(false)}
        onTakeSurvey={() => { setShowTrackerReminder(false); router.push('/forms/forms'); }}
        onRemindLater={() => setShowTrackerReminder(false)}
      />
      {/* Post actions sheet */}
      <Modal visible={showPostActionSheet} transparent animationType="fade" onRequestClose={() => setShowPostActionSheet(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { 
                setShowPostActionSheet(false); 
                if (postActionForId != null) { 
                  const foundPost = posts.find(p => isPost(p) && p.post_id === postActionForId) as Post | undefined;
                  setEditPostContent(foundPost?.post_content || ''); 
                  setEditingPostId(postActionForId); 
                } 
              }}
            >
              <FontAwesome name="pencil" size={18} color="#374151" style={{ marginRight: 8 }} />
              <Text style={styles.sheetRowText}>Edit Post</Text>
            </TouchableOpacity>
            <View style={styles.sheetDivider} />
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { 
                setShowPostActionSheet(false); 
                const id = postActionForId; 
                if (id!=null) { 
                  Alert.alert(
                    'Delete Post',
                    'Are you sure you want to delete this post?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => { 
                          try { 
                            const { deletePost } = await import('../../services/api'); 
                            await deletePost(id); 
                            await loadPosts(); 
                          } catch { 
                            Alert.alert('Error','Failed to delete'); 
                          } 
                        } 
                      }
                    ]
                  );
                }
              }}
            >
              <FontAwesome name="trash" size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={[styles.sheetRowText, { color: '#dc2626' }]}>Delete Post</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowPostActionSheet(false)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scroll: {
    paddingHorizontal: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  postCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 10,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    width: '100%',
    alignSelf: 'center',
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startPostInputWrapper: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
    justifyContent: 'center',
  },
  startPostText: {
    color: '#777',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    width: '100%',
    alignSelf: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
    color: '#666',
  },
  followBtn: {
    backgroundColor: '#E6F0FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  followText: {
    color: '#1C4E80',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    fontSize: 14,
    marginTop: 10,
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  actionIcon: {
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    fontSize: 12,
    color: '#555',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#174f84',
    fontSize: 14,
    fontWeight: '500',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  profileCourse: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  profileBatch: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  editProfileBtn: {
    marginLeft: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#E6F0FF',
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  saveBtn: {
    backgroundColor: '#174f84',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '45%',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '45%',
  },
  welcomeContainer: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 18,
    color: '#555',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 18,
    color: '#ff0000',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#174f84',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 20,
  },
  noPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 20,
  },
  noPostsText: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
  },
  pullToRefreshText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#ccc',
  },
  actionsCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  countText: {
    fontSize: 12,
    color: '#666',
  },
  likedText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxHeight: '80%',
  },
  // Unified Action Sheet styles
  sheet: {
    backgroundColor: '#fff',
    width: '88%',
    borderRadius: 16,
    paddingVertical: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetRowText: {
    fontSize: 16,
    color: '#111827',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  sheetCancel: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '88%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
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
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentName: {
    fontWeight: '600',
    color: '#111827',
  },
  commentMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  commentBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  commentBody: {
    color: '#111827',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  sendBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
});

import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackerReminderModal from '../../components/TrackerReminderModal';
import EmploymentUpdateReminderModal from '../../components/EmploymentUpdateReminderModal';
import NavBar from '../(tabs)/navbar';
import { API_BASE_URL, commentOnPost, getPosts, getUserInfo, likePost, repostPost, unlikePost, getPostDetail, editPost, getPostLikes, getPostReposts, getFeed, getActiveTrackerForm, checkUserTrackerStatus, getTrackerAcceptingStatus, fetchFollowing, checkEmploymentReminder } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
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
import { useAlert } from '../../contexts/AlertContext';
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
  const { logout: logoutFromContext } = useUser();
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
  const [isPullingDown, setIsPullingDown] = useState(false);
  const [showPostActionSheet, setShowPostActionSheet] = useState(false);
  const [postActionForId, setPostActionForId] = useState<number | null>(null);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState<string>('');
  const [actionLoadingPostId, setActionLoadingPostId] = useState<number | null>(null);
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [modalPostId, setModalPostId] = useState<number | null>(null);
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams();
  const [nowTick, setNowTick] = useState(0);
  const [showTrackerReminder, setShowTrackerReminder] = useState<boolean>(false);
  const [showEmploymentUpdateModal, setShowEmploymentUpdateModal] = useState<boolean>(false);
  const isMountedRef = React.useRef(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const navbarTranslateY = useRef(new Animated.Value(0)).current;
  // Check employment update reminder function (defined early to avoid lint errors)
  const checkEmploymentUpdateReminder = React.useCallback(async () => {
    try {
      const currentUser = await getUserInfo();
      const userId = currentUser?.user_id || currentUser?.id;
      if (!userId) {
        console.log('🔍 Employment reminder: No user ID found');
        return;
      }

      console.log('🔍 Employment reminder: Checking API for user', userId);
      const reminderData = await checkEmploymentReminder(userId);
      console.log('🔍 Employment update reminder check result:', reminderData);
      
      const shouldShow = !!reminderData?.should_show_reminder;
      if (!shouldShow) {
        console.log('ℹ️ Employment reminder: API returned false. Reason:', reminderData?.reason || 'unknown');
        return; // Don't show modal if API says no
      }

      // Check if user has dismissed this reminder
      try {
        const dismissedUntil = await AsyncStorage.getItem('employmentUpdateReminderDismissedUntil');
        if (dismissedUntil) {
          const dismissedDate = new Date(dismissedUntil);
          const now = new Date();
          if (now < dismissedDate) {
            console.log('ℹ️ Employment reminder dismissed until:', dismissedUntil);
            return; // Still within dismissal period
          } else {
            // Dismissal period expired, remove it
            await AsyncStorage.removeItem('employmentUpdateReminderDismissedUntil');
          }
        }
      } catch (_) {
        // If AsyncStorage access fails, continue anyway
      }

      // Only show if API says yes and user hasn't dismissed it
      // Delay to avoid clashing with tracker modal
      console.log('✅ Employment reminder: showing after delay');
      setTimeout(() => {
        if (isMountedRef.current) {
          setShowEmploymentUpdateModal(true);
        }
      }, 3000);
    } catch (error) {
      console.error('❌ Error checking employment update reminder:', error);
      // On error, don't show modal - it's better to not show than to show incorrectly
      // The API check ensures we only show for users who have submitted tracker with employment data
    }
  }, []);

  useEffect(() => {
    // Check for token before loading anything
    const checkAuthAndLoad = async () => {
      try {
        const { getAccessToken } = await import('../../services/api');
        const token = await getAccessToken();
        if (!token) {
          console.log('🔍 HOME DEBUG: No token on mount, redirecting to login');
          router.replace('/login/login');
          return;
        }
        // Only load if we have a token
        await loadUserInfo();
        await loadPosts();
        
        // Check employment update reminder on initial mount (like web version)
        // This ensures users who submitted tracker before see the reminder
        const currentUser = await getUserInfo();
        const accountType = (currentUser as any)?.account_type;
        if (currentUser && (accountType?.user || accountType === 'alumni')) {
          console.log('🎓 Homepage mounted - checking employment reminder for alumni user');
          // Small delay to avoid conflict with other initial loading
          setTimeout(async () => {
            if (isMountedRef.current) {
              await checkEmploymentUpdateReminder();
            }
          }, 2000);
        }
      } catch (err) {
        console.error('🔍 HOME DEBUG: Error checking auth on mount:', err);
        router.replace('/login/login');
      }
    };
    checkAuthAndLoad();
    // Tick every minute to update relative timestamps
    const t = setInterval(() => {
      if (isMountedRef.current) {
        setNowTick((x) => x + 1);
      }
    }, 60000);
    return () => {
      isMountedRef.current = false;
      clearInterval(t);
    };
  }, [checkEmploymentUpdateReminder]);
  // Setup WebSocket for real-time points updates
  useEffect(() => {
    let notificationWs: NotificationWebSocket | null = null;
    const setupWebSocket = async () => {
      try {
        const { getAccessToken } = await import('../../services/api');
        const token = await getAccessToken();
        if (!token) {
          console.log('🔍 HOME DEBUG: No access token for WebSocket, skipping setup');
          return;
        }
        const user = await getUserInfo();
        const userId = user?.user_id || user?.id;
        if (!userId) return;
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
  // Check tracker status function
  const checkTrackerStatus = React.useCallback(async () => {
    try {
      console.log('🔍 Homepage: Checking tracker status for user...');
      const [activeForm, status] = await Promise.all([
        getActiveTrackerForm(),
        checkUserTrackerStatus()
      ]);
      console.log('📊 Homepage: Tracker API responses:', { activeForm, status });
      // Get accepting status from the active form
      let acceptingStatus = null;
      try {
        acceptingStatus = await getTrackerAcceptingStatus(activeForm?.tracker_form_id);
        console.log('📋 Homepage: Accepting status:', acceptingStatus);
      } catch (error) {
        console.warn('⚠️ Homepage: Could not get accepting status, defaulting to true:', error);
        // Default to true if we can't get the status (assume form is accepting)
        acceptingStatus = { accepting_responses: true };
      }
      const trackerData = {
        accepting: Boolean(acceptingStatus?.accepting_responses),
        hasSubmitted: Boolean(status?.has_submitted)
      };
      console.log('📋 Homepage: Processed tracker data:', trackerData);
      // Show modal if form is accepting and user hasn't submitted
      if (trackerData.accepting && !trackerData.hasSubmitted) {
        console.log('🚀 Homepage: Showing tracker modal - form accepting and user not submitted');
        setShowTrackerReminder(true);
      } else {
        console.log('❌ Homepage: Not showing modal - accepting:', trackerData.accepting, 'hasSubmitted:', trackerData.hasSubmitted);
      }
    } catch (error) {
      console.error('❌ Homepage: Error checking tracker status:', error);
      // Don't show modal if there's an error checking status
    }
  }, []);

  // Refetch posts and check tracker status whenever this screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      // Don't run if component is unmounted
      if (!isMountedRef.current) return;
      // Check if we have a token before loading data
      const checkAndLoad = async () => {
        if (!isMountedRef.current) return;
        try {
          const { getAccessToken } = await import('../../services/api');
          const token = await getAccessToken();
          if (!token) {
            console.log('🔍 HOME DEBUG: No access token on focus, NavigationGuard will handle redirect');
            // Don't redirect here - let NavigationGuard handle it
            return;
          }
          if (!isMountedRef.current) return;
          await loadPosts();
          if (!isMountedRef.current) return;
          // Check tracker status every time homepage is focused
          // Get current user info if not already loaded
          let currentUser = user;
          if (!currentUser) {
            currentUser = await getUserInfo();
            if (currentUser && isMountedRef.current) {
              setUser(currentUser);
            }
          }
          if (!isMountedRef.current) return;
          // Check tracker status if user is alumni
          const accountType = (currentUser as any)?.account_type;
          if (currentUser && (accountType?.user || accountType === 'alumni')) {
            console.log('🎓 Homepage focused - checking tracker status for alumni user');
            await checkTrackerStatus();
            
            // Check if we should trigger employment reminder check after tracker submission
            const shouldCheckEmploymentReminder = await AsyncStorage.getItem('checkEmploymentReminderAfterTracker');
            if (shouldCheckEmploymentReminder === 'true') {
              // Clear the flag
              await AsyncStorage.removeItem('checkEmploymentReminderAfterTracker');
              // Wait longer for backend to process tracker submission and set tracker_submitted_at
              // The backend needs time to process TrackerResponse.save() which calls update_user_fields()
              // which sets tracker_submitted_at on TrackerData
              setTimeout(async () => {
                if (isMountedRef.current) {
                  console.log('🔔 Triggering employment reminder check after tracker submission');
                  await checkEmploymentUpdateReminder();
                }
              }, 5000); // 5 second delay to ensure backend has fully processed tracker submission
            } else {
              // Check employment update reminder (for alumni who have submitted tracker)
              await checkEmploymentUpdateReminder();
            }
          }
        } catch (err) {
          console.error('Homepage: Error in focus effect:', err);
          if (!isMountedRef.current) return;
          // If there's an auth error, NavigationGuard will handle the redirect
          if ((err as any)?.response?.status === 401 || (err as any)?.response?.status === 403) {
            console.log('🔍 HOME DEBUG: Auth error detected, NavigationGuard will handle redirect');
          }
        }
      };
      checkAndLoad();
    }, [user, checkTrackerStatus, checkEmploymentUpdateReminder])
  );
  // Add refresh functionality
  const onRefresh = async () => {
    console.log('🏠 HomeScreen pull-to-refresh triggered');
    setRefreshing(true);
    try {
      // Reload user + posts to mimic full home reload
      await loadUserInfo();
      await loadPosts();
    } catch (err) {
      console.error('🏠 HomeScreen refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };
  // Helper function to render posts with People You May Know section
  const renderPostsWithSuggestions = () => {
    const elements: React.ReactNode[] = [];
    // Always show People You May Know at the top
    elements.push(
      <View key="people-you-may-know">
        <PeopleYouMayKnowCard />
      </View>
    );
    posts.forEach((item, index) => {
      // Add the actual post first
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
            onOpenViewer={async (post, type) => {
              try {
                setSelectedPost(post);
                setViewerType(type);
                setViewerVisible(true);
                // Fetch fresh data for the viewer
                if (type === 'likes') {
                  const likesData = await getPostLikes(post.post_id);
                  setSelectedPost((prev: any) => prev ? { ...prev, likes: likesData || [] } : null);
                } else if (type === 'reposts') {
                  const repostsData = await getPostReposts(post.post_id);
                  setSelectedPost((prev: any) => prev ? { ...prev, reposts: repostsData || [] } : null);
                }
              } catch (error) {
                console.error('Error fetching viewer data:', error);
                // Still show the viewer even if fetch fails
              }
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
            onOpenViewer={async (post, type) => {
              try {
                setSelectedPost(post);
                setViewerType(type);
                setViewerVisible(true);
                // Fetch fresh data for the viewer
                if (type === 'likes') {
                  const likesData = await getPostLikes(post.post_id);
                  setSelectedPost((prev: any) => prev ? { ...prev, likes: likesData || [] } : null);
                } else if (type === 'reposts') {
                  const repostsData = await getPostReposts(post.post_id);
                  setSelectedPost((prev: any) => prev ? { ...prev, reposts: repostsData || [] } : null);
                }
              } catch (error) {
                console.error('Error fetching viewer data:', error);
                // Still show the viewer even if fetch fails
              }
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
    // Check if component is still mounted
    if (!isMountedRef.current) return;
    try {
      // Check if we have a token before trying to load user info
      const { getAccessToken } = await import('../../services/api');
      const token = await getAccessToken();
      if (!token) {
        console.log('🔍 HOME DEBUG: No access token, NavigationGuard will handle redirect');
        if (isMountedRef.current) {
          setLoading(false);
        }
        // Don't redirect here - let NavigationGuard handle it
        return;
      }
      if (isMountedRef.current) {
        setLoading(true);
      }
      const userInfo = await getUserInfo();
      console.log('🔍 HOME DEBUG: User info loaded:', userInfo);
      if (!isMountedRef.current) return;
      if (userInfo) {
        setUser(userInfo);
        setEditData({
          name: userInfo.name || '',
          course: userInfo.course || '',
          year_graduated: userInfo.year_graduated ? String(userInfo.year_graduated) : '',
          profile_pic: userInfo.profile_pic || '',
        });
      } else {
        console.log('🔍 HOME DEBUG: No user info, checking AsyncStorage...');
        // Check AsyncStorage as fallback for OJT users
        try {
          const userStr = await AsyncStorage.getItem('user');
          if (userStr) {
            const localUser = JSON.parse(userStr);
            console.log('🔍 HOME DEBUG: Found user in AsyncStorage:', localUser);
            if (isMountedRef.current) {
              setUser(localUser);
              setEditData({
                name: localUser.name || '',
                course: localUser.course || '',
                year_graduated: localUser.year_graduated ? String(localUser.year_graduated) : '',
                profile_pic: localUser.profile_pic || '',
              });
            }
          } else {
            console.log('🔍 HOME DEBUG: No user found, NavigationGuard will handle redirect');
            if (isMountedRef.current) {
              setLoading(false);
            }
            // Don't redirect here - let NavigationGuard handle it
            return;
          }
        } catch (storageErr) {
          console.error('🔍 HOME DEBUG: Error reading from AsyncStorage:', storageErr);
          if (isMountedRef.current) {
            setLoading(false);
          }
          // Don't redirect here - let NavigationGuard handle it
          return;
        }
      }
    } catch (err) {
      console.error('🔍 HOME DEBUG: Error loading user info:', err);
      if (!isMountedRef.current) return;
      // Try AsyncStorage as fallback for OJT users
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const localUser = JSON.parse(userStr);
          console.log('🔍 HOME DEBUG: Using AsyncStorage fallback:', localUser);
          if (isMountedRef.current) {
            setUser(localUser);
            setEditData({
              name: localUser.name || '',
              course: localUser.course || '',
              year_graduated: localUser.year_graduated ? String(localUser.year_graduated) : '',
              profile_pic: localUser.profile_pic || '',
            });
          }
        } else {
          if (isMountedRef.current) {
            setError('Failed to load user information');
            setLoading(false);
          }
          console.error('Error loading user info:', err);
          // Don't redirect here - let NavigationGuard handle it
          return;
        }
      } catch (localErr) {
        if (isMountedRef.current) {
          setError('Failed to load user information');
          setLoading(false);
        }
        console.error('Error loading user info:', err);
        // Don't redirect here - let NavigationGuard handle it
        return;
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  const loadPosts = async () => {
    // Check if component is still mounted
    if (!isMountedRef.current) return;
    try {
      // Check if we have a token before trying to load posts
      const { getAccessToken } = await import('../../services/api');
      const token = await getAccessToken();
      if (!token) {
        console.log('🔍 HOME DEBUG: No access token for posts, skipping load');
        if (isMountedRef.current) {
          setPosts([]);
          setPostsLoading(false);
        }
        return;
      }
      if (isMountedRef.current) {
        setPostsLoading(true);
      }
      const postsData = await getFeed();
      console.log('Homepage posts data:', postsData); // Debug log
      const me: any = await getUserInfo();
      const meId = me?.user_id || me?.id;
      let likedRepostsSet = new Set<number>();
      try {
        const raw = await AsyncStorage.getItem('likedReposts');
        likedRepostsSet = new Set<number>(raw ? JSON.parse(raw) : []);
      } catch {}
      // Get list of users the current user is following
      let followingUserIds = new Set<number>();
      try {
        if (meId) {
          const followingData = await fetchFollowing(meId);
          const followingList = followingData?.following || [];
          followingUserIds = new Set(followingList.map((u: any) => u.user_id || u.id));
        }
      } catch (error) {
        console.error('Error fetching following list:', error);
      }
      // The backend returns a flat array of feed items (posts and reposts)
      const feedItems: any[] = [];
      (Array.isArray(postsData) ? postsData : [])
        .filter((item: any) => {
          // Exclude forum posts from home feed
          if (item.type === 'forum') return false;
          // Filter donation posts: only show if user is following the creator
          if (item.type === 'donation' || item.item_type === 'donation_post') {
            const creatorId = item.user?.user_id || item.user?.id;
            // Show if it's the user's own post or if they're following the creator
            return !creatorId || creatorId === meId || followingUserIds.has(creatorId);
          }
          // Filter donation reposts: only show if user is following the reposter
          if (item.item_type === 'repost' && item.original_post?.type === 'donation') {
            const reposterId = item.user?.user_id || item.user?.id;
            // Show if it's the user's own repost or if they're following the reposter
            return !reposterId || reposterId === meId || followingUserIds.has(reposterId);
          }
          return true;
        })
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
      if (isMountedRef.current) {
        setPosts(sortedFeed);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      if (isMountedRef.current) {
        // Only show alert if component is still mounted and it's not an auth error
        if ((error as any)?.response?.status !== 401 && (error as any)?.response?.status !== 403) {
          Alert.alert('Error', 'Failed to load posts. Please try again.');
        }
        setPosts([]);
      }
    } finally {
      if (isMountedRef.current) {
        setPostsLoading(false);
      }
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
      showAlert({
        title: 'Success',
        message: 'Post reposted successfully!',
        type: 'success',
        variant: 'success',
      });
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
      showAlert({
        title: 'Success',
        message: 'Comment added successfully!',
        type: 'success',
        variant: 'success',
      });
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
              // Mark component as unmounting to prevent state updates
              isMountedRef.current = false;
              // Clear loading states immediately
              setLoading(false);
              setPostsLoading(false);
              // Use UserContext logout which updates both tokens and context state
              // This ensures NavigationGuard sees the updated auth state
              await logoutFromContext();
              // NavigationGuard will handle the redirect automatically
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
  // Handle scroll events to show/hide header and navbar
  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;

    // Detect pull-down gesture (negative offset at top)
    if (!refreshing) {
      setIsPullingDown(currentScrollY < -5);
    }
    const scrollingDown = currentScrollY > lastScrollY.current;
    const scrollingUp = currentScrollY < lastScrollY.current;
    // Only hide/show if scrolled more than 10 pixels to avoid jitter
    if (Math.abs(currentScrollY - lastScrollY.current) > 10) {
      if (scrollingDown && currentScrollY > 50 && headerVisible) {
        // Hide header and navbar when scrolling down
        setHeaderVisible(false);
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(navbarTranslateY, {
            toValue: 100,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (scrollingUp && !headerVisible) {
        // Show header and navbar when scrolling up
        setHeaderVisible(true);
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(navbarTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
    lastScrollY.current = currentScrollY;
    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    // Show header/navbar after scrolling stops
    scrollTimeout.current = setTimeout(() => {
      if (!headerVisible) {
        setHeaderVisible(true);
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(navbarTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, 500); // Show after 500ms of no scrolling
  };
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);
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
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          transform: [{ translateY: navbarTranslateY }],
        }}
      >
        <NavBar />
      </Animated.View>
      {/* Header with logout button - Fixed at top */}
      <Animated.View
        style={[
          styles.header,
          styles.stickyHeader,
          { paddingTop: insets.top + 12 },
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <Text style={styles.headerTitle}>Home</Text>
      </Animated.View>
      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: 60 + insets.top }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        alwaysBounceVertical
        bounces
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1e3a8a']}
            tintColor="#1e3a8a"
          />
        }
      >
      {(isPullingDown || refreshing) && (
        <View style={styles.refreshHintContainer}>
          <Text style={styles.refreshHintText}>
            {refreshing ? 'Refreshing…' : 'Pull down to refresh'}
          </Text>
        </View>
      )}
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
          <>
            {/* Show People You May Know even when there are no posts */}
            <View key="people-you-may-know">
              <PeopleYouMayKnowCard />
            </View>
            
            <View style={styles.noPostsContainer}>
              <Text style={styles.noPostsText}>No posts yet. Start following users or create your first post.</Text>
              <Text style={styles.pullToRefreshText}>Pull down to refresh</Text>
            </View>
          </>
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
            {(() => {
              // Calculate the number of items to determine modal height
              let itemCount = 0;
              if (viewerType === 'likes' && selectedPost && isPost(selectedPost)) {
                itemCount = selectedPost.likes?.length || 0;
              } else if (viewerType === 'reposts' && selectedPost && isPost(selectedPost)) {
                itemCount = selectedPost.reposts?.length || 0;
              } else if (viewerType === 'comments' && selectedPost && isPost(selectedPost)) {
                itemCount = selectedPost.comments?.length || 0;
              }
              // Calculate dynamic height: header (60px) + items (70px each) + padding (32px)
              // Minimum height for header only, maximum height of 600px
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
                    <Text style={styles.modalTitle}>
                      {viewerType === 'likes' ? 'Likes' : viewerType === 'comments' ? 'Comments' : 'Reposts'}
                    </Text>
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
                {viewerType === 'likes' && selectedPost && isPost(selectedPost) && selectedPost.likes?.map((u: any, idx: number) => {
                  const userId = u.user_id || u.id;
                  const currentUserId = user?.user_id || (user as any)?.id;
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
                        size={32}
                        style={styles.listAvatar}
                      />
                      <Text style={[styles.listText, userId && { color: '#1e3a8a' }]}>{formatUserFullName(u)}</Text>
                    </TouchableOpacity>
                  );
                })}
                {viewerType === 'reposts' && selectedPost && isPost(selectedPost) && selectedPost.reposts?.map((r: any) => {
                  const userId = r.user?.user_id || r.user?.id;
                  const currentUserId = user?.user_id || (user as any)?.id;
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
                        size={32}
                        style={styles.listAvatar}
                      />
                      <Text style={[styles.listText, userId && { color: '#1e3a8a' }]}>{formatUserFullName(r.user)}</Text>
                    </TouchableOpacity>
                  );
                })}
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
                          <TouchableOpacity 
                            onPress={() => {
                              const commentUserId = c.user?.user_id || c.user?.id;
                              const currentUserId = user?.user_id || (user as any)?.id;
                              if (commentUserId && commentUserId !== currentUserId) {
                                router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: commentUserId } });
                              }
                            }}
                            disabled={!c.user?.user_id && !c.user?.id}
                          >
                            <Text style={[
                              styles.commentName,
                              (c.user?.user_id || c.user?.id) && (c.user?.user_id || c.user?.id) !== (user?.user_id || (user as any)?.id) ? { color: '#1e3a8a' } : null
                            ]}>
                              {formatUserFullName(c.user)}
                            </Text>
                          </TouchableOpacity>
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
              );
            })()}
          </View>
        </Modal>
      </ScrollView>
      {/* Tracker reminder modal */}
      {/* Employment Update Reminder Modal */}
      <EmploymentUpdateReminderModal
        visible={showEmploymentUpdateModal}
        onClose={() => setShowEmploymentUpdateModal(false)}
        onUpdateNow={() => {
          setShowEmploymentUpdateModal(false);
          router.push('/settings/settings');
          // Small delay to ensure navigation happens, then open employment section
          setTimeout(() => {
            AsyncStorage.setItem('settingsOpenState', JSON.stringify({ personal: false, employment: true, password: false }));
          }, 100);
        }}
        onMaybeLater={() => {
          // Match tracker modal: just close, no long-term suppression
          AsyncStorage.removeItem('employmentUpdateReminderDismissedUntil');
          setShowEmploymentUpdateModal(false);
        }}
        onNoChanges={() => {
          // Also allow future prompts; just close
          AsyncStorage.removeItem('employmentUpdateReminderDismissedUntil');
          setShowEmploymentUpdateModal(false);
        }}
      />

      <TrackerReminderModal
        isVisible={showTrackerReminder}
        onClose={() => setShowTrackerReminder(false)}
        onTakeSurvey={async () => {
          try {
            // CRITICAL: Verify submission status before navigating to prevent re-submission
            console.log('🔍 Homepage: Verifying tracker status before navigation...');
            const status = await checkUserTrackerStatus();
            
            if (status?.has_submitted) {
              Alert.alert('Tracker', 'You have already completed the tracker form. Thank you!');
              setShowTrackerReminder(false);
              return;
            }

            // Status check passed - proceed to form
            setShowTrackerReminder(false);
            console.log('✅ Homepage: Status verified - navigating to tracker form...');
            router.push('/forms/forms');
          } catch (error) {
            console.error('❌ Homepage: Error verifying tracker status:', error);
            Alert.alert(
              'Error',
              'Unable to verify your submission status. Please check your connection and try again.',
              [{ text: 'OK' }]
            );
            setShowTrackerReminder(false);
          }
        }}
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
    flexGrow: 1,
    paddingBottom: 20,
  },
  refreshHintContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshHintText: {
    fontSize: 12,
    color: '#6b7280',
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
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    alignSelf: 'center',
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

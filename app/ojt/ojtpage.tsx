import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Animated } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserInfo, getFeed, fetchFollowing } from '../../services/api';
import NavBar from '../(tabs)/navbar';
import UserAvatar from '../../components/UserAvatar';
import PostCard from '../posts/postCard';
import RepostCard from '../repost/RepostCard';
import DonationPostCard from '../donation/DonationPostCard';
import PeopleYouMayKnowCard from '../peopleyoumayknow/PeopleYouMayKnowCard';

interface UserInfo {
  user_id?: number;
  name?: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
  course?: string;
  year_graduated?: number;
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
  original_post: any;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  item_type: 'repost';
}

type FeedItem = Post | FeedRepost;

const isRepost = (item: FeedItem): item is FeedRepost => {
  return item.item_type === 'repost';
};

const isPost = (item: FeedItem): item is Post => {
  return item.item_type === 'post' || !('repost_id' in item);
};

export default function OJTPage() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  
  // Scroll behavior state
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const navbarTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initialize = async () => {
      // Check for first-time login first - if detected, redirect will happen and function will return
      await checkFirstTimeLogin();
      // Only proceed if not redirected
      loadUserInfo();
      loadPosts();
    };
    initialize();
  }, []);

  const checkFirstTimeLogin = async () => {
    try {
      // Check if this is a first-time login that requires password change
      const { Storage } = await import('../../services/api');
      const mustChangePassword = await Storage.getItem('must_change_password');
      
      if (mustChangePassword === 'true') {
        console.log('[OJT] 🎯 First-time login detected - redirecting to password change');
        router.replace({ pathname: '/temporary-password/temporary-password', params: { first: '1' } as any });
        return;
      }
    } catch (error) {
      console.error('[OJT] Error checking first-time login status:', error);
      // Continue with normal flow if check fails
    }
  };

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      const userInfo = await getUserInfo();
      console.log('🔍 OJT DEBUG: User info loaded:', userInfo);
      
      if (userInfo) {
        setUser(userInfo);
      } else {
        console.log('🔍 OJT DEBUG: No user info, checking localStorage...');
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const localUser = JSON.parse(userStr);
          console.log('🔍 OJT DEBUG: Found user in localStorage:', localUser);
          setUser(localUser);
        } else {
          console.log('🔍 OJT DEBUG: No user found, redirecting to login');
          router.replace('/login/login');
        }
      }
    } catch (err) {
      console.error('🔍 OJT DEBUG: Error loading user info:', err);
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const localUser = JSON.parse(userStr);
          console.log('🔍 OJT DEBUG: Using localStorage fallback:', localUser);
          setUser(localUser);
        } else {
          router.replace('/login/login');
        }
      } catch (localErr) {
        router.replace('/login/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      setPostsLoading(true);
      const postsData = await getFeed();
      console.log('🔍 OJT DEBUG: Posts data:', postsData);
      
      const me: any = await getUserInfo();
      const meId = me?.user_id || me?.id;
      
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
            const repostLikesArr = Array.isArray(item?.likes) ? item.likes : [];
            const repostLikedByMe = meId ? repostLikesArr.some((l: any) => l?.user_id === meId || l?.user?.user_id === meId) : false;
            
            feedItems.push({
              ...item,
              is_liked: !!repostLikedByMe,
              item_type: 'repost'
            });
          } else {
            const likesArr = Array.isArray(item?.likes) ? item.likes : [];
            const likedByMe = meId ? likesArr.some((l: any) => l?.user_id === meId || l?.user?.user_id === meId) : false;
            
            feedItems.push({
              ...item,
              is_liked: !!likedByMe,
              item_type: 'post'
            });
          }
        });
      
      const sortedFeed = feedItems.sort((a, b) => 
        new Date(b.created_at || b.repost_date).getTime() - 
        new Date(a.created_at || a.repost_date).getTime()
      );
      
      setPosts(sortedFeed);
    } catch (error) {
      console.error('🔍 OJT DEBUG: Error loading posts:', error);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPosts();
    } finally {
      setRefreshing(false);
    }
  };

  // Handle scroll events to show/hide header and navbar
  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
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

  const renderPostsWithSuggestions = () => {
    const elements: React.ReactNode[] = [];
    
    // Always show People You May Know at the top
    elements.push(
      <View key="people-you-may-know">
        <PeopleYouMayKnowCard />
      </View>
    );
    
    posts.forEach((item, index) => {
      if (item.item_type === 'repost') {
        elements.push(
          <RepostCard
            key={`ojt-repost-${item.repost_id}`}
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
              // Handle viewer logic
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
            key={`ojt-donation-${item.post_id}`}
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
              // Handle viewer logic
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
            key={`ojt-post-${item.post_id}`}
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
              // Handle viewer logic
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading...</Text>
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
      </ScrollView>
    </View>
  );
}

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
});

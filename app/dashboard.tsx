import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Image, Dimensions } from 'react-native';
import CachedImage from '../components/CachedImage';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getUserInfo, logoutUser, getFeed, API_BASE_URL, likeRepost, unlikeRepost } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPosts as getPostsApi, likePost, unlikePost, getPostComments, commentOnPost,
  repostPost, deleteRepost, getActiveTrackerForm, checkUserTrackerStatus, getTrackerAcceptingStatus
} from '../services/api';
import UserAvatar from '../components/UserAvatar';
import { renderTextWithMentions } from '../utils/mentionUtils';
import MentionInput from '../components/MentionInput';
import TrackerReminderModal from '../components/TrackerReminderModal';
import { getImagesFromContent, getFirstImageUrl, hasImages } from '../utils/imageUtils';

export default function DashboardScreen() {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({ name: '', course: '', year_graduated: '', profile_pic: '' });
  const router = useRouter();

  // Viewer and comment state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [commentText, setCommentText] = useState('');

  // Dashboard image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<any[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const imageScrollRef = useRef<ScrollView>(null);

  // Helpers: open original post detail for repost items
  const openOriginalPostIfAvailable = (post: any) => {
    try {
      const original = post?.original_post || {};
      // Determine possible id fields
      let rawId: any = original.post_id ?? original.donation_id ?? original.id;
      if (rawId == null) return false;
      // Coerce to numeric id when possible
      let idNum: number | null = null;
      if (typeof rawId === 'number') {
        idNum = rawId;
      } else if (typeof rawId === 'string') {
        const match = rawId.match(/\d+/);
        if (match) idNum = parseInt(match[0], 10);
      }
      if (!idNum || Number.isNaN(idNum)) return false;
      const originalType = String(original.type || post.item_type || '').toLowerCase();
      const isDonation = Boolean(original.donation_id || originalType.includes('donation'));
      const query = [`postId=${idNum}`];
      if (isDonation) query.push('isDonationPost=true');
      console.log('Navigating to original detail with query:', query.join('&'), 'original:', original);
      router.push(`/posts/detail?${query.join('&')}`);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Tracker reminder state
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState<{
    accepting: boolean;
    hasSubmitted: boolean;
  } | null>(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  // Auto-refresh feed whenever dashboard regains focus
  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [])
  );

  const loadPosts = async () => {
    try {
      console.log('Loading posts...');
      const postsData = await getFeed();
      // Merge backend liked state with locally persisted repost likes
      let likedRepostsSet = new Set<number>();
      try {
        const raw = await AsyncStorage.getItem('likedReposts');
        likedRepostsSet = new Set<number>(raw ? JSON.parse(raw) : []);
      } catch {}
      const me: any = await getUserInfo().catch(() => null);
      const meId = me?.user_id || me?.id;
      const normalized = Array.isArray(postsData) ? postsData.map((it: any) => {
        if (it?.item_type === 'repost') {
          const likesArr = Array.isArray(it.likes) ? it.likes : [];
          const backendLiked = meId ? likesArr.some((l: any) => (l?.user_id || l?.user?.user_id) === meId) : false;
          const locallyLiked = likedRepostsSet.has(it.repost_id);
          return { ...it, is_liked: backendLiked || locallyLiked };
        }
        return it;
      }) : [];
      setPosts(normalized || []);
      console.log('Posts loaded successfully:', postsData?.length || 0);
    } catch (err: any) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts');
    }
  };

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      
      // First check if user is authenticated
      const userInfo = await getUserInfo();
      if (!userInfo) {
        console.log('No user info found, redirecting to login');
        router.replace('/login/login');
        return;
      }
      
      console.log('User authenticated, loading feed...');
      const postsData = await getFeed();
      
      setUser(userInfo);
      setEditData({
        name: userInfo.name || '',
        course: userInfo.course || '',
        year_graduated: userInfo.year_graduated ? String(userInfo.year_graduated) : '',
        profile_pic: userInfo.profile_pic || '',
      });

      // Check tracker status for alumni users
      console.log('👤 User account type:', userInfo.account_type);
      if (userInfo.account_type === 'alumni') {
        console.log('🎓 User is alumni, checking tracker status...');
        await checkTrackerStatus();
      } else {
        console.log('❌ User is not alumni, skipping tracker check');
      }
      
      // Merge backend liked state with locally persisted repost likes
      let likedRepostsSet = new Set<number>();
      try {
        const raw = await AsyncStorage.getItem('likedReposts');
        likedRepostsSet = new Set<number>(raw ? JSON.parse(raw) : []);
      } catch {}
      const meId = userInfo?.user_id || userInfo?.id;
      const normalized = Array.isArray(postsData) ? postsData.map((it: any) => {
        if (it?.item_type === 'repost') {
          const likesArr = Array.isArray(it.likes) ? it.likes : [];
          const backendLiked = meId ? likesArr.some((l: any) => (l?.user_id || l?.user?.user_id) === meId) : false;
          const locallyLiked = likedRepostsSet.has(it.repost_id);
          return { ...it, is_liked: backendLiked || locallyLiked };
        }
        return it;
      }) : [];
      setPosts(normalized || []);
    } catch (err: any) {
      console.error('Error loading user info:', err);
      
      // If it's a 403 error, the user might not be properly authenticated
      if (err.response?.status === 403) {
        console.log('403 error - user not authenticated, redirecting to login');
        setError('Session expired. Please log in again.');
        router.replace('/login/login');
        return;
      }
      
      setError('Failed to load user information');
    } finally {
      setLoading(false);
    }
  };

  const checkTrackerStatus = async () => {
    try {
      console.log('🔍 Checking tracker status for user...');
      const [activeForm, status] = await Promise.all([
        getActiveTrackerForm(),
        checkUserTrackerStatus()
      ]);

      console.log('📊 Tracker API responses:', { activeForm, status });

      // Get accepting status from the active form
      let acceptingStatus = null;
      try {
        acceptingStatus = await getTrackerAcceptingStatus(activeForm?.tracker_form_id);
        console.log('📋 Accepting status:', acceptingStatus);
      } catch (error) {
        console.warn('⚠️ Could not get accepting status, defaulting to true:', error);
        // Default to true if we can't get the status (assume form is accepting)
        acceptingStatus = { accepting_responses: true };
      }

      const trackerData = {
        accepting: Boolean(acceptingStatus?.accepting_responses),
        hasSubmitted: Boolean(status?.has_submitted)
      };

      console.log('📋 Processed tracker data:', trackerData);
      setTrackerStatus(trackerData);

      // Show modal if form is accepting and user hasn't submitted
      if (trackerData.accepting && !trackerData.hasSubmitted) {
        console.log('🚀 Showing tracker modal - form accepting and user not submitted');
        setShowTrackerModal(true);
      } else {
        console.log('❌ Not showing modal - accepting:', trackerData.accepting, 'hasSubmitted:', trackerData.hasSubmitted);
      }
    } catch (error) {
      console.error('❌ Error checking tracker status:', error);
      // Don't show modal if there's an error checking status
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
    setUser(user ? { ...user, ...editData } : editData);
    setEditModalVisible(false);
    Alert.alert('Profile updated (not saved to backend)');
  };

  const handleTakeSurvey = () => {
    setShowTrackerModal(false);
    console.log('🚀 Navigating to tracker form...');
    router.push('/forms/forms');
  };

  const handleRemindLater = () => {
    setShowTrackerModal(false);
  };

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {user && (
        <View style={styles.profileCard}>
          <Image
            source={{ uri: user.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg' }}
            style={styles.profilePic}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileCourse}>{user.course || 'Bachelor of Science in IT'}</Text>
            {user.year_graduated && (
              <Text style={styles.profileBatch}>Batch {user.year_graduated}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditProfile}>
            <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tracker Status Button for Alumni */}
      {user && user.account_type === 'alumni' && (
        <View style={styles.trackerStatusCard}>
          <View style={styles.trackerStatusContent}>
            <FontAwesome name="clipboard" size={20} color="#1e3a8a" />
            <View style={styles.trackerStatusText}>
              <Text style={styles.trackerStatusTitle}>Graduate Tracer Survey</Text>
              <Text style={styles.trackerStatusSubtitle}>
                {trackerStatus?.hasSubmitted 
                  ? 'You have completed the survey. Thank you!' 
                  : trackerStatus?.accepting 
                    ? 'Please complete your graduate tracer survey'
                    : 'Survey is currently closed'
                }
              </Text>
            </View>
            {trackerStatus?.accepting && !trackerStatus?.hasSubmitted && (
              <TouchableOpacity 
                style={styles.trackerButton}
                onPress={() => {
                  console.log('🚀 Tracker status card - Navigating to tracker form...');
                  router.push('/forms/forms');
                }}
              >
                <Text style={styles.trackerButtonText}>Take Survey</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={editData.name}
              onChangeText={(text) => setEditData({ ...editData, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Course"
              value={editData.course}
              onChangeText={(text) => setEditData({ ...editData, course: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Batch (Year Graduated)"
              value={editData.year_graduated}
              onChangeText={(text) => setEditData({ ...editData, year_graduated: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Profile Picture URL"
              value={editData.profile_pic}
              onChangeText={(text) => setEditData({ ...editData, profile_pic: text })}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {user && (
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome back, {user.name}!</Text>
        </View>
      )}

      {/* Start a Post */}
      <View style={styles.startPostCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image 
            source={{ uri: user?.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg' }} 
            style={styles.startPostAvatar} 
          />
          <TouchableOpacity 
            style={styles.startPostInput} 
            onPress={() => router.push('/posts/post')}
          >
            <Text style={{ color: '#888' }}>Start a post</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {posts.length === 0 ? (
          <View style={styles.noPostsContainer}>
            <Text style={styles.noPostsText}>No posts yet. Be the first to share something!</Text>
          </View>
        ) : (
          posts.map((post) => (
            <View key={post.repost_id || post.post_id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Image
                  source={{ uri: post.user?.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg' }}
                  style={styles.postAuthorPic}
                />
                <View style={styles.postAuthorInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.postAuthor}>
                      {post.user?.f_name} {post.user?.l_name}
                    </Text>
                    {post.item_type === 'donation_post' && (
                      <View style={styles.donationBadge}>
                        <Text style={styles.donationBadgeText}>DONATION</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.postDate}>
                    {new Date(post.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              {post.post_title && (
                <Text style={styles.postTitle}>{post.post_title}</Text>
              )}
              <Text style={styles.postContent}>{post.post_content}</Text>
              {post.original_post && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-start', marginTop: 6, marginBottom: 4 }}
                  onPress={() => {
                    try {
                      const original = post.original_post || {};
                      const originalId = original.post_id || original.donation_id || original.id;
                      const originalType = (original.type || post.item_type || '').toString().toLowerCase();
                      const isDonation = Boolean(
                        original.donation_id ||
                        originalType.includes('donation')
                      );
                      if (originalId) {
                        const query = [`postId=${originalId}`];
                        if (isDonation) query.push('isDonationPost=true');
                        router.push(`/posts/detail?${query.join('&')}`);
                      } else {
                        console.warn('Original post id not found on repost item:', post);
                      }
                    } catch (e) {}
                  }}
                >
                  <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>View original post</Text>
                </TouchableOpacity>
              )}
              
              {/* Images - Facebook-style grid layout like web */}
              {(() => {
                console.log('=== DASHBOARD IMAGE DEBUG ===');
                console.log('Post data:', JSON.stringify(post, null, 2));
                console.log('Post post_images:', post.post_images);
                console.log('Post post_image:', post.post_image);
                
                // Use the proper image utility function to avoid duplicates
                // Prefer original post images for repost items
                const sourceForImages = post?.original_post ? post.original_post : post;
                // Robust extraction for donation/original posts that may use `images` field
                // Gather images from multiple potential fields on repost originals (defensive)
                const tryArrays: any[] = [];
                const s: any = sourceForImages as any;
                if (Array.isArray(s.images)) tryArrays.push(s.images);
                if (Array.isArray(s.post_images)) tryArrays.push(s.post_images);
                if (Array.isArray(s.content_images)) tryArrays.push(s.content_images);
                // Some backends nest images further
                if (s.original && Array.isArray(s.original.images)) tryArrays.push(s.original.images);
                if (s.original && Array.isArray(s.original.post_images)) tryArrays.push(s.original.post_images);
                // Flatten and normalize
                let images = tryArrays.length
                  ? ([] as any[]).concat(...tryArrays).map((img: any) => ({ image_url: img?.image_url || img?.url || img }))
                  : getImagesFromContent(sourceForImages);
                // Deduplicate by URL
                const seen = new Set<string>();
                images = images.filter((im: any) => {
                  const u = String(im?.image_url || '').trim();
                  if (!u) return false;
                  const key = u.toLowerCase().split('?')[0];
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
                
                console.log('Dashboard - Images to display:', images);
                console.log('Dashboard - Images length:', images.length);
                console.log('=== END DASHBOARD IMAGE DEBUG ===');
                
                if (images.length === 0) return null;
                
                return (
                  <View style={styles.imagesContainer}>
                    {images.length === 1 ? (
                      // Single image - full width
                      <TouchableOpacity onPress={() => {
                        if (post.original_post && openOriginalPostIfAvailable(post)) return;
                        setViewerImages(images); setViewerIndex(0); setImageViewerVisible(true);
                      }}>
                        <CachedImage uri={images[0].image_url} style={styles.singleImage} contentFit="cover" />
                      </TouchableOpacity>
                    ) : (
                      // Multiple images - Facebook-style grid layout
                      <View style={styles.imagesGrid}>
                        {images.slice(0, 4).map((image: any, index: number) => {
                          const imageUri = String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}`;
                          return (
                            <TouchableOpacity key={index} style={styles.fourImagesGrid} onPress={() => {
                              if (post.original_post && openOriginalPostIfAvailable(post)) return;
                              setViewerImages(images); setViewerIndex(index); setImageViewerVisible(true);
                            }}>
                              <CachedImage uri={imageUri} style={styles.gridImage} contentFit="cover" />
                              {index === 3 && images.length > 4 && (
                                <View style={styles.moreImagesOverlay}>
                                  <Text style={styles.moreImagesText}>+{images.length - 4}</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })()}
              <View style={styles.postFooter}>
                <Text style={styles.postCategory}>
                  {post.category?.personal ? 'Personal' : 
                   post.category?.events ? 'Events' : 
                   post.category?.announcements ? 'Announcements' : 
                   post.category?.donation ? 'Donation' : 'Other'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => { setSelectedPost(post); setViewerType('likes'); setViewerVisible(true); }}>
                    <Text style={styles.postStats}>{post.likes_count || 0} likes</Text>
                  </TouchableOpacity>
                  <Text style={styles.postStats}> • </Text>
                  <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}>
                    <Text style={styles.postStats}>{post.comments_count || 0} comments</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={async () => {
                    try {
                      const isRepost = post?.item_type === 'repost' || typeof post?.repost_id === 'number';
                      if (post.is_liked) {
                        if (post.item_type === 'donation_post') {
                          // Handle donation post unlike
                          const { unlikeDonationPost } = await import('../services/api');
                          await unlikeDonationPost(post.post_id);
                        } else if (isRepost) {
                          await unlikeRepost(post.repost_id);
                          try {
                            const key = 'likedReposts';
                            const raw = await AsyncStorage.getItem(key);
                            const set = new Set<number>(raw ? JSON.parse(raw) : []);
                            set.delete(post.repost_id);
                            await AsyncStorage.setItem(key, JSON.stringify(Array.from(set)));
                          } catch {}
                        } else {
                          await unlikePost(post.post_id);
                        }
                        setPosts(prev => prev.map(p => {
                          const pIsRepost = p?.item_type === 'repost' || typeof p?.repost_id === 'number';
                          const match = pIsRepost && isRepost ? (p.repost_id === post.repost_id) : (p.post_id === post.post_id);
                          return match ? { ...p, is_liked: false, likes_count: Math.max(0, (p.likes_count||0)-1) } : p;
                        }));
                      } else {
                        if (post.item_type === 'donation_post') {
                          // Handle donation post like
                          const { likeDonationPost } = await import('../services/api');
                          await likeDonationPost(post.post_id);
                        } else if (isRepost) {
                          await likeRepost(post.repost_id);
                          try {
                            const key = 'likedReposts';
                            const raw = await AsyncStorage.getItem(key);
                            const set = new Set<number>(raw ? JSON.parse(raw) : []);
                            set.add(post.repost_id);
                            await AsyncStorage.setItem(key, JSON.stringify(Array.from(set)));
                          } catch {}
                        } else {
                          await likePost(post.post_id);
                        }
                        setPosts(prev => prev.map(p => {
                          const pIsRepost = p?.item_type === 'repost' || typeof p?.repost_id === 'number';
                          const match = pIsRepost && isRepost ? (p.repost_id === post.repost_id) : (p.post_id === post.post_id);
                          return match ? { ...p, is_liked: true, likes_count: (p.likes_count||0)+1 } : p;
                        }));
                      }
                      // Auto-refresh feed after like/unlike
                      setTimeout(() => loadPosts(), 500);
                    } catch (e) {
                      Alert.alert('Error', 'Failed to update like');
                    }
                  }}
                >
                  <FontAwesome name={post.is_liked ? 'thumbs-up' : 'thumbs-o-up'} size={16} color="#888" />
                  <Text style={styles.actionText}>Like</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => router.push(`/posts/comments?postId=${post.post_id}${post.item_type === 'donation_post' ? '&isDonationPost=true' : ''}`)}
                >
                  <FontAwesome name="comment-o" size={16} color="#888" />
                  <Text style={styles.actionText}>Comment</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={async () => {
                    try {
                      if (post.item_type === 'donation_post') {
                        // Handle donation post repost
                        const { repostDonationPost } = await import('../services/api');
                        await repostDonationPost(post.post_id);
                        router.push(`/donation/donation-repost?postId=${post.post_id}`);
                      } else {
                        await repostPost(post.post_id);
                        setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, reposts_count: (p.reposts_count||0)+1 } : p));
                        Alert.alert('Reposted');
                        // Auto-refresh feed after repost
                        setTimeout(() => loadPosts(), 500);
                      }
                    } catch (e) {
                      Alert.alert('Error', 'Failed to repost');
                    }
                  }}
                >
                  <FontAwesome name="retweet" size={16} color="#888" />
                  <Text style={styles.actionText}>Repost</Text>
                </TouchableOpacity>
              </View>

      {/* Image Viewer Modal for dashboard */}
      <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <TouchableOpacity
            onPress={() => setImageViewerVisible(false)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.6)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
          {viewerImages.length > 1 && (
            <View style={{ position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, zIndex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{viewerIndex + 1} of {viewerImages.length}</Text>
            </View>
          )}
          <ScrollView
            ref={imageScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: viewerIndex * screenWidth, y: 0 }}
            onLayout={() => {
              if (imageScrollRef.current) {
                imageScrollRef.current.scrollTo({ x: viewerIndex * screenWidth, y: 0, animated: false });
              }
            }}
            onMomentumScrollEnd={(event) => {
              const idx = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setViewerIndex(idx);
            }}
          >
            {viewerImages.map((img, idx) => (
              <View key={idx} style={{ width: screenWidth, height: screenHeight, justifyContent: 'center', alignItems: 'center' }}>
                <CachedImage
                  uri={String(img.image_url).startsWith('http') ? img.image_url : `${API_BASE_URL}${img.image_url}`}
                  style={{ width: screenWidth, height: screenHeight * 0.8 }}
                  contentFit="contain"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
            </View>
          ))
        )}
      </ScrollView>
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
              {viewerType === 'likes' && selectedPost?.likes?.map((u: any, idx: number) => (
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

              {viewerType === 'reposts' && selectedPost?.reposts?.map((r: any) => (
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

              {viewerType === 'comments' && selectedPost?.comments?.map((c: any) => (
                <View key={c.comment_id} style={styles.commentRow}>
                  <Image source={{ uri: c.user?.profile_pic || 'https://randomuser.me/api/portraits/women/46.jpg' }} style={styles.commentAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.commentHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commentName}>{c.user?.f_name} {c.user?.l_name}</Text>
                        <Text style={styles.commentMeta}>{new Date(c.date_created).toLocaleString()}</Text>
                      </View>
                    </View>
                    <View style={styles.commentBubble}>
                      {renderTextWithMentions(c.comment_content, [], (userId) => {
                        router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                      })}
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            {viewerType === 'comments' && selectedPost ? (
              <View style={styles.commentInputRow}>
                <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  placeholder="Write a comment..."
                  style={styles.commentInput}
                />
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={async () => {
                    const message = (commentText || '').trim();
                    if (!message) return;
                    try {
                      await commentOnPost(selectedPost.post_id, message);
                      const data = await getPostComments(selectedPost.post_id);
                      const newComments = data?.comments || [];
                      setPosts(prev => prev.map(p => p.post_id === selectedPost.post_id ? { ...p, comments: newComments, comments_count: newComments.length } : p));
                      setSelectedPost((prev: any) => prev ? { ...prev, comments: newComments, comments_count: newComments.length } : prev);
                      setCommentText('');
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

      {/* Tracker Reminder Modal */}
      <TrackerReminderModal
        isVisible={showTrackerModal}
        onClose={() => setShowTrackerModal(false)}
        onTakeSurvey={handleTakeSurvey}
        onRemindLater={handleRemindLater}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 10,
    marginTop: 15,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    backgroundColor: '#e0e7ef',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#174f84',
  },
  profileCourse: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  profileBatch: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  editProfileBtn: {
    backgroundColor: '#e0e7ef',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#174f84',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  saveBtn: {
    backgroundColor: '#174f84',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: '#e0e7ef',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  welcomeContainer: {
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 16,
    color: '#174f84',
    fontWeight: 'bold',
  },
  scrollView: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  postAuthor: {
    fontWeight: 'bold',
    color: '#174f84',
    marginBottom: 4,
  },
  postContent: {
    fontSize: 14,
    color: '#333',
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
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postAuthorPic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  postAuthorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  donationBadge: {
    backgroundColor: '#059669', // Green color for donation
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  donationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#174f84',
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  postCategory: {
    fontSize: 12,
    color: '#4B944D',
    fontWeight: 'bold',
  },
  postStats: {
    fontSize: 12,
    color: '#666',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    color: '#666',
    marginLeft: 6,
  },
  startPostCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  startPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  startPostInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxHeight: '80%',
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
    backgroundColor: '#174f84',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
  trackerStatusCard: {
    backgroundColor: 'white',
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  trackerStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackerStatusText: {
    flex: 1,
    marginLeft: 12,
  },
  trackerStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  trackerStatusSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  trackerButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  trackerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Image grid styles
  imagesContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignSelf: 'center',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'space-between',
  },
  fourImagesGrid: {
    width: '49%',
    height: 150,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

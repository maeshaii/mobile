import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { followUser, getUserInfo, checkFollowStatus, getDonationPosts, createDonationPost, getDonationLikes, getDonationReposts } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import DonationPostCard from './DonationPostCard';
import RepostCard from '../repost/RepostCard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import MentionInput from '../../components/MentionInput';
import { convertImageToBase64 } from '../../utils/imageUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ctuLogo = require('../../assets/images/ctu_logo.png');

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  type?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  user: { user_id: number; f_name: string; l_name: string; profile_pic?: string | null };
}

interface UserProfile {
  profile_pic?: string;
  f_name?: string;
  l_name?: string;
}

export default function DonationPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any | null>(null);
  const [showDonationCreate, setShowDonationCreate] = useState(false);
  const [donationMessage, setDonationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [swipeableCardIndex, setSwipeableCardIndex] = useState(0);
  const swipeableCardRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const [persistedLikedPostIds, setPersistedLikedPostIds] = useState<Set<number>>(new Set());

  const storageKeyForUser = useCallback((userId?: number | null) => {
    return `DONATION_LIKED_POST_IDS_${userId ?? 'anon'}`;
  }, []);

  const loadPersistedLikes = useCallback(async (userId?: number | null) => {
    try {
      const key = storageKeyForUser(userId);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const arr: number[] = JSON.parse(raw);
        setPersistedLikedPostIds(new Set(arr));
      } else {
        setPersistedLikedPostIds(new Set());
      }
    } catch {
      setPersistedLikedPostIds(new Set());
    }
  }, [storageKeyForUser]);

  const savePersistedLikes = useCallback(async (ids: Set<number>, userId?: number | null) => {
    try {
      const key = storageKeyForUser(userId);
      await AsyncStorage.setItem(key, JSON.stringify(Array.from(ids)));
    } catch {
      // ignore storage errors
    }
  }, [storageKeyForUser]);

  const handleSuggestionsChange = (showSuggestions: boolean, inputPosition?: { x: number; y: number; width: number; height: number } | null) => {
    if (showSuggestions && scrollViewRef.current && inputPosition) {
      // Calculate scroll offset to move input and dropdown above keyboard
      // Dropdown max height is ~300px, add padding
      const dropdownHeight = 320;
      const padding = 20;
      
      // Scroll upward to make room for dropdown
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ 
          y: dropdownHeight + padding, 
          animated: true 
        });
      }, 150);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks < 5) return `${diffWeeks}w`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) return `${diffMonths}mo`;
      const diffYears = Math.floor(diffDays / 365);
      return `${diffYears}y`;
    } catch {
      return '';
    }
  };

  async function loadDonationPosts() {
      try {
        const userInfo = await getUserInfo();
        setUser(userInfo);
      const meId = (userInfo as any)?.id || (userInfo as any)?.user_id || null;
      setCurrentUserId(meId);
        // Load persisted likes for this user and use them immediately
        let localLikedIds = new Set<number>();
        try {
          const key = storageKeyForUser(meId);
          const raw = await AsyncStorage.getItem(key);
          const arr: number[] = raw ? JSON.parse(raw) : [];
          localLikedIds = new Set(arr.map(Number));
          // keep state in sync for subsequent interactions
          setPersistedLikedPostIds(localLikedIds);
        } catch {
          setPersistedLikedPostIds(new Set());
        }
        const donationPosts = await getDonationPosts();
        console.log('Donation page - Raw donation posts:', donationPosts);
        const arr = Array.isArray(donationPosts)
          ? donationPosts
          : Array.isArray(donationPosts?.donations)
            ? donationPosts.donations
            : [];

        // Create feed items that include both donation posts and reposts
        const feedItems: any[] = [];
        
        arr.forEach((d: any) => {
          // Add original donation post
          const imagesArray = Array.isArray(d.images)
            ? d.images.map((img: any, idx: number) => ({
                image_url: typeof img === 'string' ? img : (img.image_url || img.url || img.path),
                order: img.order ?? idx,
              }))
            : [];
          
          const postId = d.donation_id ?? d.post_id ?? d.id;
          // Prioritize backend is_liked field - it's the source of truth
          const backendIsLiked = d.is_liked !== undefined ? !!d.is_liked : false;
          // Only use local storage as fallback if backend doesn't provide is_liked
          const localIsLiked = backendIsLiked === false ? localLikedIds.has(Number(postId)) : false;
          feedItems.push({
            post_id: d.donation_id ?? d.post_id ?? d.id,
            post_title: d.post_title ?? undefined,
            post_content: d.description ?? d.post_content ?? '',
            post_image: d.post_image ?? (imagesArray[0]?.image_url || null),
            post_images: imagesArray, // Add all images array
            images: imagesArray, // Also add as 'images' for compatibility
            type: d.type ?? 'donation',
            created_at: d.created_at ?? d.donation_date ?? d.date_created ?? null,
            likes_count: d.likes_count ?? (Array.isArray(d.likes) ? d.likes.length : 0),
            comments_count: d.comments_count ?? (Array.isArray(d.comments) ? d.comments.length : 0),
            reposts_count: d.reposts_count ?? (Array.isArray(d.reposts) ? d.reposts.length : 0),
            // Backend is_liked is the source of truth; local storage is only a fallback
            is_liked: backendIsLiked || localIsLiked,
            user: d.user || { user_id: 0, f_name: 'Unknown', l_name: 'User', profile_pic: null },
            item_type: 'post'
          });
          console.log(`Donation post ${feedItems[feedItems.length - 1].post_id} - is_liked: ${feedItems[feedItems.length - 1].is_liked} (backend: ${backendIsLiked}, local: ${localIsLiked})`);

          // Add donation reposts as separate feed items
          const reposts = Array.isArray(d.reposts) ? d.reposts : [];
          reposts.forEach((r: any) => {
            // Prioritize backend is_liked field for reposts
            const repostIsLiked = r.is_liked !== undefined ? !!r.is_liked : false;
            feedItems.push({
              ...r,
              item_type: 'repost',
              original_post: {
                post_id: d.donation_id ?? d.post_id ?? d.id,
                post_content: d.description ?? d.post_content ?? '',
                post_image: d.post_image ?? (imagesArray[0]?.image_url || null),
                post_images: imagesArray, // Add all images array
                images: imagesArray, // Also add as 'images' for compatibility
                user: d.user || { user_id: 0, f_name: 'Unknown', l_name: 'User', profile_pic: null },
                created_at: d.created_at ?? d.donation_date ?? d.date_created ?? null,
                likes_count: r.likes_count || d.likes_count || 0,
                comments_count: r.comments_count || d.comments_count || 0,
                reposts_count: r.reposts_count || d.reposts_count || 0,
                is_liked: repostIsLiked,
              }
            });
          });
        });

        // Sort by date (newest first)
        const sorted = feedItems.sort((a, b) =>
          new Date(b.repost_date || b.created_at).getTime() - new Date(a.repost_date || a.created_at).getTime()
        );

        setPosts(sorted);
      } catch (e) {
        setUser(null);
        setPosts([]);
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => { loadDonationPosts(); }, []);

  // Auto-refresh donation feed when screen regains focus (after post/repost/edit/delete)
  useFocusEffect(
    useCallback(() => {
      loadDonationPosts();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadDonationPosts(); } finally { setRefreshing(false); }
  };

  const pickImages = async () => {
    try {
      console.log('Starting image picker...');
      
      // Request permissions first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission result:', permissionResult);
      
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library to attach images.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable editing to allow multiple selection
        quality: 0.5, // Reduced quality to reduce file size
        allowsMultipleSelection: true, // Enable multiple image selection
      });

      console.log('Image picker result:', result);
      console.log('Canceled:', result.canceled);
      console.log('Assets:', result.assets);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`Selected ${result.assets.length} images`);
        const maxImages = 15;
        const newImages = result.assets.slice(0, maxImages - selectedImages.length);
        console.log(`Adding ${newImages.length} new images (max: ${maxImages}, current: ${selectedImages.length})`);
        
        // Store the original file URIs instead of converting to base64
        const imageUris: string[] = [];
        for (const asset of newImages) {
          try {
            console.log('Storing image URI:', asset.uri);
            imageUris.push(asset.uri);
            console.log('Successfully stored image URI');
          } catch (error) {
            console.error('Error storing image URI:', error);
          }
        }
        
        console.log(`Successfully stored ${imageUris.length} image URIs`);
        setSelectedImages(prev => {
          const newList = [...prev, ...imageUris];
          console.log(`Total images now: ${newList.length}`);
          return newList;
        });
      } else {
        console.log('No images selected or picker was canceled');
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDonationSubmit = async () => {
    if (!donationMessage.trim()) {
      Alert.alert('Error', 'Please provide a description of your need');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('=== DONATION SUBMISSION DEBUG ===');
      console.log('Donation message:', donationMessage.trim());
      console.log('Selected images:', selectedImages);
      console.log('Selected images length:', selectedImages.length);
      console.log('Selected images types:', selectedImages.map(img => typeof img));
      console.log('=== END DONATION SUBMISSION DEBUG ===');
      
      // Show progress for image uploads
      if (selectedImages.length > 0) {
        Alert.alert('Processing', 'Compressing images and preparing upload...', [], { cancelable: false });
      }
      
      // Process images - compress and convert to base64 like the post creation page
      let processedImages: string[] = [];
      
      if (selectedImages.length > 0) {
        try {
          const base64Images = [];
          for (let i = 0; i < selectedImages.length; i++) {
            const imageUri = selectedImages[i];
            console.log(`Processing image ${i + 1}/${selectedImages.length}: ${imageUri}`);
            
            if (imageUri.startsWith('file://')) {
              // Compress the image first
              const compressedImage = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                  { resize: { width: 800 } }, // Resize to max width of 800px
                ],
                { 
                  compress: 0.7, // 70% quality
                  format: ImageManipulator.SaveFormat.JPEG 
                }
              );
              
              console.log(`Compressed image ${i + 1}: ${compressedImage.uri}`);
              
              const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
                encoding: 'base64',
              });
              base64Images.push(`data:image/jpeg;base64,${base64}`);
            } else {
              base64Images.push(imageUri);
            }
          }
          processedImages = base64Images;
          console.log(`Successfully processed ${base64Images.length} images`);
        } catch (error) {
          console.error('Error converting images to base64:', error);
          Alert.alert('Error', 'Failed to process images. Please try again.');
          return;
        }
      }
      
      const response = await createDonationPost({
        description: donationMessage.trim(),
        images: processedImages
      });
      
      if (response.success) {
        Alert.alert('Success', 'Your donation request has been posted!');
        setDonationMessage('');
        setSelectedImages([]);
        setShowDonationCreate(false);
        // Refresh the donation posts
        await loadDonationPosts();
      } else {
        Alert.alert('Error', response.message || 'Failed to submit donation request');
      }
    } catch (error) {
      console.error('Error creating donation request:', error);
      
      // Provide more specific error messages like the post creation page
      let errorMessage = 'Failed to submit donation request. Please try again.';
      let errorTitle = 'Error';
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('ECONNABORTED')) {
          errorTitle = 'Upload Timeout';
          errorMessage = 'The upload timed out. This might be due to large images or slow connection. Please try with fewer or smaller images.';
        } else if (error.message.includes('Network Error') || error.message.includes('ERR_NETWORK')) {
          errorTitle = 'Network Error';
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('413') || error.message.includes('too large')) {
          errorTitle = 'File Too Large';
          errorMessage = 'Images are too large. Please try with smaller images or fewer images.';
        } else if (error.message.includes('Invalid image format')) {
          errorTitle = 'Invalid Image';
          errorMessage = 'One or more images are in an unsupported format. Please try with different images.';
        }
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.scrollContainer}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#c62828"]} tintColor="#c62828" />}
    >
      {/* Red Header with Back Button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Org Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image source={ctuLogo} style={styles.profileImage} />
        </View>
      </View>

      {/* Swipeable Info Cards */}
      <View style={styles.swipeableContainer}>
        <ScrollView
          ref={swipeableCardRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setSwipeableCardIndex(index);
          }}
          style={styles.swipeableScrollView}
        >
          {/* About Donations Card */}
          <View style={[styles.swipeableCard, { width: screenWidth }]}>
            <View style={styles.infoCard}>
              <View style={styles.infoTitleContainer}>
                <Text style={styles.infoTitleEmoji}>❤️</Text>
                <Text style={[styles.infoTitle, { color: '#c62828' }]}>About Donations</Text>
              </View>
              <Text style={styles.infoText}>
                A dedicated space for CTU alumni to connect and support each other through donations. Whether you need assistance or want to help fellow alumni, this platform brings our community together for mutual aid and solidarity.
              </Text>
              <View style={styles.bulletSection}>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#c62828' }]} />
                  <Text style={styles.bulletText}>Connect with alumni from your batch and beyond</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#c62828' }]} />
                  <Text style={styles.bulletText}>Support causes that matter to our community</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#c62828' }]} />
                  <Text style={styles.bulletText}>Build stronger alumni relationships</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#c62828' }]} />
                  <Text style={styles.bulletText}>Share resources and opportunities</Text>
                </View>
              </View>
              <View style={styles.quoteBox}>
                <Text style={styles.quoteText}>"Together we can make a difference in each other's lives."</Text>
              </View>
            </View>
          </View>

          {/* Tips for Effective Requests Card */}
          <View style={[styles.swipeableCard, { width: screenWidth }]}>
            <View style={styles.infoCard}>
              <Text style={[styles.infoTitle, { color: '#059669' }]}>💡 Tips for Effective Requests</Text>
              <View style={[styles.bulletSection, { borderTopColor: 'rgba(5, 150, 105, 0.1)' }]}>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Provide clear details about your situation</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Include relevant photos or documents</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Set realistic timelines if applicable</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Update your request as circumstances change</Text>
                </View>
              </View>
            </View>
          </View>

          {/* How to Help Card */}
          <View style={[styles.swipeableCard, { width: screenWidth }]}>
            <View style={styles.infoCard}>
              <Text style={[styles.infoTitle, { color: '#059669' }]}>🤝 How to Help</Text>
              <View style={[styles.bulletSection, { borderTopColor: 'rgba(5, 150, 105, 0.1)' }]}>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Share requests to increase visibility</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Reach out privately to offer assistance</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Connect requesters with relevant resources</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#059669' }]} />
                  <Text style={styles.bulletText}>Follow up to see how you can continue helping</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        
        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                swipeableCardIndex === index && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      </View>
      {/* Start a Post and Posts */}
      <View style={styles.postsContainer}>
        <View style={styles.startPostCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <UserAvatar 
              profilePic={user?.profile_pic}
              firstName={user?.f_name}
              lastName={user?.l_name}
              size={48}
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.startPostInput} onPress={() => setShowDonationCreate(true)}>
              <Text style={{ color: '#888', fontSize: 15 }}>Share what you need or how you can help...</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Posts and Reposts */}
        {loading ? null : posts.map((item: any, index) => {
        if (item.item_type === 'repost') {
          return (
            <RepostCard
              key={`donation-repost-${item.repost_id}`}
              repost={item}
              currentUserId={currentUserId || undefined}
              origin="donation"
              onLikeToggle={(repostId, liked) => {
                setPosts((prev) => prev.map((p: any) => {
                  if (p.item_type === 'repost' && p.repost_id === repostId) {
                    return {
                      ...p,
                      is_liked: liked,
                      likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)),
                    };
                  }
                  return p;
                }));
              }}
              onOpenViewer={(repost, type) => {
                setSelectedPostStats({...repost, item_type: 'repost'});
                setViewerType(type);
                setViewerVisible(true);
              }}
              onEdited={(repostId, newCaption) => {
                setPosts(prev => prev.map((p: any) => {
                  if (p.item_type === 'repost' && p.repost_id === repostId) {
                    return { ...p, repost_caption: newCaption };
                  }
                  return p;
                }));
              }}
              onDeleted={(repostId) => {
                setPosts(prev => prev.filter((p: any) => !(p.item_type === 'repost' && p.repost_id === repostId)));
              }}
            />
          );
        } else {
          return (
            <DonationPostCard
              key={item.post_id}
              post={item}
              currentUserId={currentUserId || undefined}
              onLikeToggle={(postId, isLiked) => {
                console.log(`Like toggle for post ${postId}: ${isLiked}`);
                // Update UI immediately
                setPosts(prev => prev.map((p: any) => {
                  if (p.post_id === postId) {
                    const updated = { ...p, is_liked: isLiked, likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) };
                    console.log(`Updated post ${postId} - is_liked: ${updated.is_liked}, likes_count: ${updated.likes_count}`);
                    return updated;
                  }
                  return p;
                }));
                // Persist like state locally per user
                setPersistedLikedPostIds(prev => {
                  const next = new Set(prev);
                  if (isLiked) {
                    next.add(Number(postId));
                  } else {
                    next.delete(Number(postId));
                  }
                  // Fire-and-forget save
                  savePersistedLikes(next, currentUserId).catch(() => {});
                  return next;
                });
                // Refresh donation posts after like/unlike to get updated state from backend
                setTimeout(() => {
                  console.log(`Refreshing donation posts after like toggle for post ${postId}`);
                  loadDonationPosts();
                }, 1000);
              }}
              onOpenViewer={async (post, type) => {
                try {
                  setSelectedPostStats(post);
                  setViewerType(type);
                  setViewerVisible(true);
                  
                  // Fetch likes or reposts data based on type
                  if (type === 'likes') {
                    const likesData = await getDonationLikes(post.post_id);
                    setSelectedPostStats((prev: any) => ({ ...prev, likes: likesData.likes || [] }));
                  } else if (type === 'reposts') {
                    const repostsData = await getDonationReposts(post.post_id);
                    setSelectedPostStats((prev: any) => ({ ...prev, reposts: repostsData.reposts || [] }));
                  }
                } catch (error) {
                  console.error('Error fetching viewer data:', error);
                  Alert.alert('Error', 'Failed to load data');
                }
              }}
              onEdited={(postId, newContent) => {
                setPosts(prev => prev.map((p: any) => 
                  p.post_id === postId 
                    ? { ...p, post_content: newContent }
                    : p
                ));
                // Auto-refresh donation posts after edit
                setTimeout(() => loadDonationPosts(), 500);
              }}
              onDeleted={(postId) => {
                setPosts(prev => prev.filter((p: any) => p.post_id !== postId));
                // Auto-refresh donation posts after delete
                setTimeout(() => loadDonationPosts(), 500);
              }}
              onRepostToggle={(postId, isReposted) => {
                setPosts(prev => prev.map((p: any) => 
                  p.post_id === postId 
                    ? { ...p, reposts_count: isReposted ? (p.reposts_count || 0) + 1 : Math.max(0, (p.reposts_count || 0) - 1) }
                    : p
                ));
                // Auto-refresh donation posts after repost
                setTimeout(() => loadDonationPosts(), 500);
              }}
            />
          );
        }
        })}
      </View>

      {/* Likes/Reposts Viewer Modal */}
      <Modal visible={viewerVisible} transparent animationType="slide" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>
                {viewerType === 'likes' ? 'Likes' : viewerType === 'reposts' ? 'Reposts' : 'Comments'}
              </Text>
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

      {/* Donation Creation Modal - Full Screen Style */}
      <Modal visible={showDonationCreate} animationType="slide" onRequestClose={() => setShowDonationCreate(false)}>
        <View style={styles.fullScreenModal}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity 
              style={styles.topBarButtonLeft} 
              onPress={() => setShowDonationCreate(false)}
              disabled={isSubmitting}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>REQUEST HELP</Text>
            <TouchableOpacity 
              style={[styles.topBarButtonRight, isSubmitting && styles.disabledButton]} 
              onPress={handleDonationSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#222" />
              ) : (
                <Text style={styles.postButton}>POST</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.separator} />
        
          {/* User Info */}
          <View style={styles.postContainer}>
            <View style={styles.userRow}>
              <UserAvatar 
                profilePic={user?.profile_pic}
                firstName={user?.f_name}
                lastName={user?.l_name}
                size={40}
                style={styles.avatar}
              />
              <Text style={styles.userName}>{user?.f_name} {user?.l_name}</Text>
            </View>

            {/* Post Input */}
            <MentionInput
              value={donationMessage}
              onChange={setDonationMessage}
              placeholder="Describe your situation and how donations would help..."
              style={styles.input}
              multiline
              onSuggestionsChange={handleSuggestionsChange}
            />

            {/* Character Count */}
            <Text style={styles.charCount}>{donationMessage.length}/1000</Text>
          </View>

          {/* Add Image Section */}
          <View style={styles.addImageContainer}>
            <TouchableOpacity 
              style={styles.addImageRow} 
              onPress={pickImages}
            >
              <FontAwesome name="image" size={32} color="#4B944D" style={styles.addImageIcon} />
              <Text style={styles.addImageText}>
                {selectedImages.length > 0 ? `${selectedImages.length} Image${selectedImages.length > 1 ? 's' : ''} Selected` : 'Add Image(s)'}
              </Text>
            </TouchableOpacity>
            
            {/* Display multiple selected images */}
            {selectedImages.length > 0 && (
              <ScrollView horizontal style={styles.imagesContainer}>
                {selectedImages.map((image, index) => (
                  <View key={index} style={styles.selectedImageContainer}>
                    <Image source={{ uri: image }} style={styles.selectedImage} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  postsContainer: {
    paddingHorizontal: 10,
  },
  headerContainer: {
    position: 'relative',
  },
  headerBg: {
    height: 160,
    backgroundColor: '#c62828',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    width: '100%',
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
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 50,
  },
  swipeableContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  swipeableScrollView: {
    marginHorizontal: 0,
  },
  swipeableCard: {
    paddingHorizontal: 16,
  },
  startPostCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  startPostInput: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    borderRadius: 30,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ccc',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#c62828',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  // Full Screen Modal Styles - matching post creation interface
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 35,
    position: 'relative',
    height: 40,
  },
  topBarButtonLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  topBarButtonRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  closeIcon: { 
    fontSize: 24, 
    color: '#333' 
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
    textAlign: 'center',
    flex: 1,
  },
  postButton: { 
    color: '#222', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
    marginBottom: 10,
  },
  postContainer: {
    marginTop: 1,
    paddingHorizontal: 16,
  },
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12,
    marginTop: 10,
  },
  userName: { 
    fontWeight: 'bold', 
    fontSize: 15, 
    color: '#222',
    marginTop: -15,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 16,
    textAlignVertical: 'top',
    color: '#D9D9D9',
  },
  charCount: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    marginTop: -10,
    marginBottom: 10,
  },
  addImageContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    // iOS shadow (top only)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    // Android shadow
    elevation: 4,
    // Optional: add a thin border at the top
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
    marginTop: 30,
  },
  addImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addImageIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  addImageText: {
    color: '#4B944D',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagesContainer: {
    marginTop: 10,
    maxHeight: 150,
  },
  selectedImageContainer: {
    position: 'relative',
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  removeImageText: {
    color: '#fff',
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.7,
  },
  // Info cards
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  infoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitleEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  infoText: {
    color: '#5a6c7d',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  bulletSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(198, 40, 40, 0.1)',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
    marginTop: 6,
  },
  bulletText: {
    color: '#5a6c7d',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  quoteBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  quoteText: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

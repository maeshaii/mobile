import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, ActivityIndicator, ScrollView, TextInput, Dimensions } from 'react-native';
import CachedImage from '../../components/CachedImage';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { API_BASE_URL, likeRepost, unlikeRepost, repostPost, deleteRepost, updateRepost, getRepostLikes, getRepostComments, commentOnRepost, updateRepostComment, deleteRepostComment, getPostReposts, getPostDetail, getForumDetail, getDonationDetail, getDonationReposts } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserAvatar from '../../components/UserAvatar';
import { getImagesFromContent } from '../../utils/imageUtils';
import { renderTextWithMentions } from '../../utils/mentionUtils';
import { formatUserFullName, formatLikeCountText } from '../../utils/nameUtils';
import { useAlert } from '../../contexts/AlertContext';
import SeeMoreText from '../../components/SeeMoreText';

dayjs.extend(relativeTime);

interface OriginalPost {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  type?: string | null;
  created_at?: string | null;
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  forum_id?: number;
  donation_id?: number;
  is_event?: boolean;
  event_date?: string | null;
  event_time?: string | null;
  user: { 
    user_id: number; 
    f_name: string; 
    m_name?: string | null;
    l_name: string; 
    profile_pic?: string | null;
    account_type?: string;
    user_type?: string;
  };
}

interface Repost {
  repost_id: number;
  repost_caption?: string;
  created_at: string;
  user: {
    f_name: string;
    m_name?: string | null;
    l_name: string;
    profile_pic?: string;
    user_id?: number;
    account_type?: string;
    user_type?: string;
  };
  original_post: OriginalPost;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  likes?: any[];
}

interface Props {
  repost: Repost;
  currentUserId?: number;
  onLikeToggle?: (repostId: number, isLiked: boolean) => void;
  onOpenViewer?: (repost: Repost, type: 'likes' | 'comments' | 'reposts') => void;
  onEdited?: (repostId: number, newCaption: string) => void;
  onDeleted?: (repostId: number) => void;
  onOriginalPostReposted?: (originalPostId: number) => void;
  origin?: 'forum' | 'donation' | 'feed';
}

const RepostCard: React.FC<Props> = ({ repost, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted, onOriginalPostReposted, origin }) => {
  const router = useRouter();
  const { showAlert, showConfirm } = useAlert();

  console.log('RepostCard - repost data:', repost);
  console.log('RepostCard - repost caption:', repost.repost_caption);
  console.log('RepostCard - original_post:', repost.original_post);
  console.log('RepostCard - repost likes:', repost.likes);
  console.log('RepostCard - currentUserId:', currentUserId);
  console.log('RepostCard - is_liked field:', repost.is_liked);

  // Local state for repost actions
  const [isLiked, setIsLiked] = useState(repost.is_liked || false);
  const [likeCount, setLikeCount] = useState(repost.likes_count || 0);
  const [repostCount, setRepostCount] = useState(repost.original_post?.reposts_count || 0);
  const [showActions, setShowActions] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState(repost.repost_caption || '');
  const [editLoading, setEditLoading] = useState(false);
  // Likes & Comments modals
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesUsers, setLikesUsers] = useState<any[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const imageScrollRef = useRef<ScrollView>(null);
  
  // Comment system
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentText, setEditCommentText] = useState<{ [key: number]: string }>({});

  const repostUserName = formatUserFullName(repost.user);
  const originalUserName = formatUserFullName(repost.original_post.user);
  
  // Check if users are admin or peso for priority display
  const repostUserType = repost.user?.account_type || repost.user?.user_type || 'user';
  const originalUserType = repost.original_post?.user?.account_type || repost.original_post?.user?.user_type || 'user';
  const isRepostAdmin = repostUserType === 'admin';
  const isRepostPeso = repostUserType === 'peso';
  const isOriginalAdmin = originalUserType === 'admin';
  const isOriginalPeso = originalUserType === 'peso';
  
  // Check if the original post is a donation
  const isDonationPost = Boolean(
    repost.original_post?.type === 'donation' ||
    repost.original_post?.donation_id ||
    origin === 'donation'
  );

  // Check if the original post is an event
  const isEventPost = Boolean(
    repost.original_post?.is_event ||
    (repost.original_post as any)?.is_event
  );

  // Sync like state and repost count when repost data changes
  useEffect(() => {
    let liked: any = repost.is_liked;
    if ((liked === undefined || liked === null) && currentUserId && Array.isArray(repost.likes)) {
      liked = repost.likes.some((l: any) => (l?.user_id || l?.user?.user_id) === currentUserId);
    }
    setIsLiked(Boolean(liked));
    setLikeCount(repost.likes_count || 0);
    // Use original post's repost count, not the repost's own repost count
    setRepostCount(repost.original_post?.reposts_count || 0);
  }, [repost.is_liked, repost.likes_count, repost.original_post?.reposts_count, repost.likes, currentUserId]);
  const repostTimeFromNow = (() => {
    const t = (repost as any)?.created_at || (repost as any)?.repost_date;
    return t ? dayjs(t).fromNow() : '';
  })();
  const originalTimeFromNow = (() => {
    const t = (repost.original_post as any)?.created_at;
    return t ? dayjs(t).fromNow() : '';
  })();

  // Determine if the original post is unavailable (deleted/removed/private)
  const isOriginalUnavailable = !repost.original_post || Boolean(
    (repost as any)?.original_post?.is_deleted ||
    (repost as any)?.original_post?.deleted_at ||
    (repost as any)?.original_post?.removed ||
    (repost as any)?.original_post?.removed_for_policy ||
    (repost as any)?.original_post?.status === 'deleted' ||
    (repost as any)?.original_post?.visibility === 'private'
  );

  // Use centralized image utility with deduplication
  // Also support backends that nest the original under `original` or different arrays
  let originalImages = repost.original_post ? getImagesFromContent(repost.original_post) : [];
  if (originalImages.length === 0 && (repost as any)?.original_post?.original) {
    originalImages = getImagesFromContent((repost as any).original_post.original);
  }
  const originalImageUrl = originalImages.length > 0 
    ? (String(originalImages[0].image_url).startsWith('http') ? originalImages[0].image_url : `${API_BASE_URL}${originalImages[0].image_url}`)
    : null;

  /** --- Actions --- **/
  const handleLike = async () => {
    try {
      console.log('Attempting to like repost:', repost.repost_id);
      
      // Optimistic update first
      const newLikedState = !isLiked;
      setIsLiked(newLikedState);
      setLikeCount((c) => Math.max(0, c + (newLikedState ? 1 : -1)));
      onLikeToggle?.(repost.repost_id, newLikedState);

      // Try to like/unlike the repost using dedicated repost endpoints
      if (isLiked) {
        await unlikeRepost(repost.repost_id);
        try {
          const key = 'likedReposts';
          const raw = await AsyncStorage.getItem(key);
          const set = new Set<number>(raw ? JSON.parse(raw) : []);
          set.delete(repost.repost_id);
          await AsyncStorage.setItem(key, JSON.stringify(Array.from(set)));
        } catch {}
      } else {
        await likeRepost(repost.repost_id);
        try {
          const key = 'likedReposts';
          const raw = await AsyncStorage.getItem(key);
          const set = new Set<number>(raw ? JSON.parse(raw) : []);
          set.add(repost.repost_id);
          await AsyncStorage.setItem(key, JSON.stringify(Array.from(set)));
        } catch {}
      }
      
      console.log('Successfully updated repost like status');
    } catch (error: any) {
      console.error('Error liking repost:', error);
      console.error('Repost ID:', repost.repost_id);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Revert optimistic update on error
      setIsLiked(isLiked);
      setLikeCount((c) => Math.max(0, c + (isLiked ? 1 : -1)));
      onLikeToggle?.(repost.repost_id, isLiked);
      
      // Show actual error message instead of generic message
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to like repost';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleRepost = async () => {
    if (isOriginalUnavailable) {
      Alert.alert('Unavailable', 'Cannot repost because the original post is unavailable.');
      return;
    }
    
    // Get the original post ID - can be post_id, forum_id, or donation_id
    const original: any = repost.original_post || {};
    const originalPostId = original.post_id || original.forum_id || original.donation_id;
    const isForum = original.type === 'forum' || !!original.forum_id || origin === 'forum';
    const isDonation = original.type === 'donation' || !!original.donation_id || origin === 'donation';
    
    // Validate original post ID
    if (!originalPostId) {
      Alert.alert('Error', 'Invalid post ID. Cannot repost this post.');
      return;
    }
    
    console.log('RepostCard - Navigating to repost screen with postId:', originalPostId, 'isForum:', isForum, 'isDonation:', isDonation);
    
    // Navigate to repost screen for the original post
    if (isDonation) {
      // For donations, we need to handle it differently - use donation repost screen
      router.push({
        pathname: '/donation/donation-repost',
        params: { postId: originalPostId.toString() }
      });
      return;
    }
    router.push({
      pathname: '/repost/repost',
      params: { 
        postId: originalPostId.toString(),
        ...(isForum && { isForumPost: 'true' })
      }
    });
    // Note: Original post repost count will be updated when the user returns to this screen
  };

  const handleOriginalPostPress = () => {
    const original: any = repost.original_post || {};
    // Accept multiple possible id fields from backend
    const idCandidate = original.post_id ?? original.donation_id ?? original.forum_id ?? original.id;
    if (idCandidate == null) return;
    const postId = String(idCandidate);
    const route: any = { pathname: '/posts/detail', params: { postId } };
    // Decide content type for proper detail rendering
    const typeStr = String(original.type || original.post_type || original.content_type || '').toLowerCase();
    if (origin === 'forum' || original.forum_id || typeStr.includes('forum')) {
      route.params.isForumPost = 'true';
    }
    // Heuristics to detect donation content across inconsistent payloads
    const looksLikeDonation = (
      origin === 'donation' ||
      !!original.donation_id ||
      typeStr.includes('donation') ||
      typeof original.goal_amount !== 'undefined' ||
      typeof original.raised_amount !== 'undefined' ||
      typeof original.beneficiary !== 'undefined' ||
      typeof original.donor_count !== 'undefined'
    );
    if (looksLikeDonation) {
      route.params.isDonationPost = 'true';
    }
    console.log('RepostCard - Original press route:', route);
    router.push(route);
  };

  const handleDelete = async () => {
    showConfirm({
      title: 'Delete Repost',
      message: 'Are you sure you want to delete this repost?',
      confirmText: 'Delete',
      type: 'warning',
      destructive: true,
      onConfirm: async () => {
        try {
          const response = await deleteRepost(repost.repost_id);
          if (response.success !== false) {
            showAlert({
              title: 'Success',
              message: 'Repost deleted successfully.',
              type: 'success',
              variant: 'success',
            });
            onDeleted?.(repost.repost_id);
          } else {
            Alert.alert('Error', response.message || 'Failed to delete repost.');
          }
        } catch (error: any) {
          console.error('Delete repost error:', error);
          Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to delete repost.');
        }
      },
    });
  };

  const handleEdit = async () => {
    if (editLoading) return;
    
    try {
      setEditLoading(true);
      await updateRepost(repost.repost_id, editCaption.trim());
      onEdited?.(repost.repost_id, editCaption.trim());
      setEditModal(false);
      showAlert({
        title: 'Success',
        message: 'Repost caption updated successfully!',
        type: 'success',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error editing repost:', error);
      Alert.alert('Error', 'Failed to edit repost caption.');
    } finally {
      setEditLoading(false);
    }
  };

  const openLikes = async () => {
    try {
      console.log('Opening likes for repost:', repost.repost_id);
      setLikesModalVisible(true);
      setLikesLoading(true);
      const response = await getRepostLikes(repost.repost_id);
      console.log('Repost likes response:', response);
      // Backend returns {likes: [...]} so we need to extract the likes array
      const users = response?.likes || [];
      console.log('Extracted likes users:', users);
      setLikesUsers(users);
    } catch (e) {
      console.error('Error loading repost likes:', e);
      Alert.alert('Error', 'Failed to load likes');
      setLikesUsers([]);
    } finally {
      setLikesLoading(false);
    }
  };

  const openCommentModal = async () => {
    // Navigate to full-screen comments view instead of modal
    console.log('RepostCard - Opening comment modal for repostId:', repost.repost_id);
    try {
      router.push({
        pathname: '/repost/repost-comments',
        params: { repostId: repost.repost_id.toString() }
      });
    } catch (error) {
      console.error('Error navigating to comments:', error);
      Alert.alert('Error', 'Unable to open comments. Please try again.');
    }
  };

  const loadComments = async () => {
    try {
      setCommentsLoading(true);
      const commentsData = await getRepostComments(repost.repost_id);
      setComments(Array.isArray(commentsData) ? commentsData : []);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      setSubmittingComment(true);
      await commentOnRepost(repost.repost_id, commentText.trim());
      setCommentText('');
      await loadComments(); // Reload comments
      showAlert({
        title: 'Success',
        message: 'Comment added successfully',
        type: 'success',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = async (commentId: number) => {
    const text = editCommentText[commentId];
    if (!text?.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      await updateRepostComment(repost.repost_id, commentId, text.trim());
      setEditingComment(prev => ({ ...prev, [commentId]: false }));
      setEditCommentText(prev => ({ ...prev, [commentId]: '' }));
      await loadComments(); // Reload comments
      showAlert({
        title: 'Success',
        message: 'Comment updated successfully',
        type: 'success',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error editing comment:', error);
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRepostComment(repost.repost_id, commentId);
              await loadComments(); // Reload comments
              showAlert({
                title: 'Success',
                message: 'Comment deleted successfully',
                type: 'success',
                variant: 'success',
              });
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  const renderAvatar = (src?: string) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  // Removed comment functions since we're using full-screen navigation

  return (
    <View style={styles.card}>
      {/* Repost Header */}
      <View style={styles.repostHeader}>
        <TouchableOpacity
          onPress={() => {
            const uid = repost.user?.user_id;
            if (uid) {
              if (uid === currentUserId) {
                router.push('/profile/profilepage');
              } else {
                router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: uid } });
              }
            }
          }}
          disabled={!repost.user?.user_id}
          style={styles.repostUserContainer}
        >
          <UserAvatar 
            profilePic={repost.user?.profile_pic}
            firstName={repost.user?.f_name}
            lastName={repost.user?.l_name}
            size={24}
            style={styles.headerAvatar}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.nameContainer}>
              <Text style={[
                styles.repostUser,
                (repost.user?.user_id && repost.user?.user_id !== currentUserId) ? styles.clickableName : null
              ]}>{repostUserName}</Text>
              {(isRepostAdmin || isRepostPeso) && (
                <View style={[
                  styles.priorityBadge,
                  isRepostAdmin ? styles.adminBadge : styles.pesoBadge
                ]}>
                  <Text style={styles.priorityBadgeText}>
                    {isRepostAdmin ? 'ADMIN' : 'PESO'}
                  </Text>
                </View>
              )}
              {isDonationPost && (
                <View style={styles.donationBadge}>
                  <Text style={styles.donationBadgeText}>DONATION</Text>
                </View>
              )}
              {isEventPost && (
                <View style={styles.eventBadge}>
                  <Text style={styles.eventBadgeText}>EVENT</Text>
                </View>
              )}
            </View>
            {!!repostTimeFromNow && (
              <Text style={styles.repostMeta}>{repostTimeFromNow}</Text>
            )}
          </View>
        </TouchableOpacity>
        {currentUserId === repost.user?.user_id && (
          <TouchableOpacity
            onPress={() => setShowActions(true)}
            style={{ padding: 6, marginLeft: 'auto' }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome name="ellipsis-h" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      {/* Caption (if exists) directly below header */}
      {repost.repost_caption && repost.repost_caption.trim() ? (
        <SeeMoreText
          text={repost.repost_caption}
          maxLength={500}
          style={styles.caption}
        />
      ) : null}

      {/* Original Post (Embedded) */}
      {isOriginalUnavailable ? (
        <View style={styles.originalPost}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FontAwesome name="ban" size={16} color="#6b7280" />
            <Text style={[styles.originalUserName, { marginLeft: 8 }]}>Original post unavailable</Text>
          </View>
          <Text style={styles.originalContent}>This content was deleted, removed, or is no longer available.</Text>
        </View>
      ) : (
        repost.original_post && (
          <TouchableOpacity style={styles.originalPost} onPress={handleOriginalPostPress} activeOpacity={0.8}>
            <View style={styles.originalHeader}>
              <TouchableOpacity
                onPress={() => {
                  const uid = repost.original_post.user?.user_id;
                  if (uid) {
                    if (uid === currentUserId) {
                      router.push('/profile/profilepage');
                    } else {
                      router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: uid } });
                    }
                  }
                }}
                disabled={!repost.original_post.user?.user_id}
                style={styles.originalUserContainer}
              >
                <UserAvatar 
                  profilePic={repost.original_post.user?.profile_pic}
                  firstName={repost.original_post.user?.f_name}
                  lastName={repost.original_post.user?.l_name}
                  size={36}
                  style={styles.originalAvatar}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameContainer}>
                    <Text style={[
                      styles.originalUserName,
                      (repost.original_post.user?.user_id && repost.original_post.user?.user_id !== currentUserId) ? styles.clickableName : null
                    ]}>{originalUserName}</Text>
                    {(isOriginalAdmin || isOriginalPeso) && (
                      <View style={[
                        styles.priorityBadge,
                        isOriginalAdmin ? styles.adminBadge : styles.pesoBadge
                      ]}>
                        <Text style={styles.priorityBadgeText}>
                          {isOriginalAdmin ? 'ADMIN' : 'PESO'}
                        </Text>
                      </View>
                    )}
                    {isDonationPost && (
                      <View style={styles.donationBadge}>
                        <Text style={styles.donationBadgeText}>DONATION</Text>
                      </View>
                    )}
                    {isEventPost && (
                      <View style={styles.eventBadge}>
                        <Text style={styles.eventBadgeText}>EVENT</Text>
                      </View>
                    )}
                  </View>
                  {!!originalTimeFromNow && (
                    <Text style={styles.originalMeta}>{originalTimeFromNow}</Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Original Content */}
            {/* Note: Backend doesn't provide post_title for original post in repost detail */}
            <SeeMoreText
              text={repost.original_post.post_content}
              maxLength={500}
              renderText={(text) => renderTextWithMentions(text, [], (userId) => {
                router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
              })}
              style={styles.originalContent}
              buttonBelow={true}
            />
          
          {/* Original Images - support multiple images */}
          {originalImages.length > 0 && (
            <View style={styles.originalImagesContainer}>
              {originalImages.length === 1 ? (
                <TouchableOpacity 
                  onPress={() => {
                    setSelectedImageIndex(0);
                    setImageViewerVisible(true);
                  }}
                >
                  <CachedImage uri={originalImageUrl || ''} style={styles.originalImage} contentFit="contain" />
                </TouchableOpacity>
              ) : (
                <View style={styles.originalImagesGrid}>
                  {originalImages.slice(0, 4).map((image, index) => (
                    <TouchableOpacity 
                      key={index}
                      onPress={() => {
                        setSelectedImageIndex(index);
                        setImageViewerVisible(true);
                      }}
                      style={styles.originalGridImage}
                    >
                      <CachedImage 
                        uri={String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}`}
                        style={styles.originalGridImageContent}
                        contentFit="cover"
                      />
                      {index === 3 && originalImages.length > 4 && (
                        <View style={styles.originalMoreImagesOverlay}>
                          <Text style={styles.originalMoreImagesText}>+{originalImages.length - 4}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          </TouchableOpacity>
        )
      )}

      {/* Repost Stats */}
      <View style={styles.actionsCountsRow}>
        {/* Like count column */}
        <View style={styles.countItem}>
          {likeCount > 0 && (
            <TouchableOpacity onPress={openLikes}>
              <Text style={styles.countText}>
                {formatLikeCountText(repost.likes, likeCount, currentUserId, isLiked)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Comment count column */}
        <View style={styles.countItem}>
          {(repost.comments_count || 0) > 0 && (
            <TouchableOpacity onPress={openCommentModal}>
              <Text style={styles.countText}>
                {repost.comments_count || 0}{' '}
                {(repost.comments_count || 0) === 1 ? 'comment' : 'comments'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Repost count column */}
        <View style={styles.countItem}>
          {(repostCount || 0) > 0 && (
          <TouchableOpacity
          onPress={async () => {
          // When viewing reposts, show the original post's reposts, not the repost's own reposts
          if (onOpenViewer && repost.original_post) {
            const original = repost.original_post;
            const originalPostId = original.post_id || original.forum_id || original.donation_id;
            
            if (!originalPostId) {
              Alert.alert('Error', 'Unable to load reposts');
              return;
            }

            try {
              // First, pass the original post with existing reposts (if any) to show immediately
              const originalPostWithReposts = {
                ...original,
                reposts: original.reposts || []
              };
              onOpenViewer(originalPostWithReposts as any, 'reposts');

              // Then fetch fresh reposts data asynchronously
              let repostsArray: any[] = [];
              
              // Check the post type
              const isForum = original.type === 'forum' || !!original.forum_id || origin === 'forum';
              const isDonation = original.type === 'donation' || !!original.donation_id || origin === 'donation';
              
              if (isForum) {
                // For forum posts, get reposts from forum detail
                try {
                  const forumDetail = await getForumDetail(originalPostId);
                  repostsArray = Array.isArray(forumDetail?.reposts) ? forumDetail.reposts : [];
                } catch (error) {
                  console.error('Error fetching forum reposts:', error);
                  repostsArray = [];
                }
              } else if (isDonation) {
                // For donation posts, get reposts from donation detail
                try {
                  const donationDetail = await getDonationDetail(originalPostId);
                  repostsArray = Array.isArray(donationDetail?.reposts) ? donationDetail.reposts : [];
                } catch (error) {
                  console.error('Error fetching donation reposts:', error);
                  repostsArray = [];
                }
              } else {
                // For regular posts, use getPostReposts
                try {
                  repostsArray = await getPostReposts(originalPostId);
                } catch (error) {
                  // Fallback: try to get from post detail
                  try {
                    const postDetail = await getPostDetail(originalPostId);
                    repostsArray = Array.isArray(postDetail?.reposts) ? postDetail.reposts : [];
                  } catch (e) {
                    console.error('Error fetching post reposts:', e);
                    repostsArray = [];
                  }
                }
              }

              // Update the viewer with fresh reposts data
              const updatedPost = {
                ...original,
                reposts: repostsArray
              };
              onOpenViewer(updatedPost as any, 'reposts');
            } catch (error) {
              console.error('Error loading reposts:', error);
              // Still show the viewer with empty reposts
              const originalPostWithReposts = {
                ...original,
                reposts: []
              };
              onOpenViewer(originalPostWithReposts as any, 'reposts');
            }
          }
          }}>
            <Text style={styles.countText}>
              {repostCount || 0}{' '}
              {(repostCount || 0) === 1 ? 'repost' : 'reposts'}
            </Text>
          </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Repost Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionIcon}
          onPress={handleLike}
        >
          <FontAwesome
            name={isLiked ? 'thumbs-up' : 'thumbs-o-up'}
            size={18}
            color={isLiked ? '#1e3a8a' : '#555'}
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionIcon}
          onPress={openCommentModal}
        >
          <FontAwesome name="comment-o" size={18} color="#555" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionIcon} onPress={handleRepost}>
          <FontAwesome name="retweet" size={18} color="#555" />
          <Text style={styles.actionText}>Repost</Text>
        </TouchableOpacity>
      </View>

      {/* Action Sheet Modal */}
      <Modal visible={showActions} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setShowActions(false);
                // Navigate to full-screen repost screen in edit mode so UI matches create repost
                router.push({
                  pathname: '/repost/repost',
                  params: {
                    mode: 'edit',
                    repostId: String(repost.repost_id),
                    initialCaption: repost.repost_caption || '',
                  },
                });
              }}
            >
              <FontAwesome name="pencil" size={18} color="#374151" style={{ marginRight: 8 }} />
              <Text style={styles.sheetRowText}>Edit Caption</Text>
            </TouchableOpacity>
            <View style={styles.sheetDivider} />
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setShowActions(false);
                handleDelete();
              }}
            >
              <FontAwesome name="trash" size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={[styles.sheetRowText, { color: '#dc2626' }]}>Delete Repost</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowActions(false)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Caption Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <TouchableOpacity onPress={() => setEditModal(false)} style={styles.editModalCloseButton}>
                <FontAwesome name="times" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.editModalTitle}>Edit Caption</Text>
              <TouchableOpacity 
                onPress={handleEdit}
                disabled={editLoading}
                style={[styles.editModalSaveButton, editLoading && { opacity: 0.7 }]}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editModalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.editModalInput}
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="Add a caption..."
              placeholderTextColor="#888"
              multiline
              maxLength={5000}
            />
          </View>
        </View>
      </Modal>

      {/* Likes Modal */}
      <Modal visible={likesModalVisible} transparent animationType="slide" onRequestClose={() => setLikesModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Likes {likesUsers.length}</Text>
              <TouchableOpacity onPress={() => setLikesModalVisible(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {likesLoading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#1e3a8a" />
                  <Text style={{ marginTop: 8, color: '#666' }}>Loading likes...</Text>
                </View>
              ) : (
                <>
                  {!likesUsers || likesUsers.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={styles.emptyText}>No likes yet</Text>
                    </View>
                  ) : (
                    likesUsers.map((like, idx) => {
                      // Add safety checks for like data
                      if (!like || !like.user) return null;
                      const user = like.user;
                      const userId = user.user_id || user.id;
                      const isCurrentUser = userId && currentUserId && userId === currentUserId;
                      return (
                        <TouchableOpacity
                          key={`like-${like.like_id || idx}`}
                          style={styles.listItemRow}
                          onPress={() => {
                            if (userId) {
                              setLikesModalVisible(false);
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
                            profilePic={user.profile_pic} 
                            firstName={user.f_name || 'User'} 
                            lastName={user.l_name || ''} 
                            size={36} 
                            style={styles.listAvatar} 
                          />
                          <Text style={[styles.listText, userId && { color: '#1e3a8a' }]}>
                            {formatUserFullName(user)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comment modal removed - now using full-screen navigation */}

      {/* Image Viewer Modal */}
      <Modal visible={imageViewerVisible} transparent animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity 
            style={styles.imageViewerCloseButton}
            onPress={() => setImageViewerVisible(false)}
          >
            <Text style={styles.imageViewerCloseText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.imageViewerContainer}>
            {originalImages.length > 1 && (
              <View style={styles.imageViewerCounter}>
                <Text style={styles.imageViewerCounterText}>
                  {selectedImageIndex + 1} of {originalImages.length}
                </Text>
              </View>
            )}
            <ScrollView
              ref={imageScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedImageIndex * screenWidth, y: 0 }}
              onLayout={() => {
                if (imageScrollRef.current) {
                  imageScrollRef.current.scrollTo({ x: selectedImageIndex * screenWidth, y: 0, animated: false });
                }
              }}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setSelectedImageIndex(index);
              }}
            >
              {originalImages.map((image, index) => (
                <View key={index} style={{ width: screenWidth, height: screenHeight, justifyContent: 'center', alignItems: 'center' }}>
                  <CachedImage
                    uri={String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}`}
                    style={[styles.imageViewerImage, { width: screenWidth, height: screenHeight * 0.8 }]}
                    contentFit="contain"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
    alignSelf: 'center',
  },
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerAvatar: {
    marginRight: 8,
  },
  repostUser: {
    fontSize: 14,
    color: '#111',
    marginLeft: 0,
    fontWeight: '600',
    flex: 1,
  },
  repostMeta: {
    fontSize: 11,
    color: '#666',
  },
  caption: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  originalPost: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 12,
  },
  originalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#ccc',
  },
  originalUserName: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#333',
  },
  originalMeta: {
    fontSize: 11,
    color: '#666',
  },
  originalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },
  originalContent: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 8,
  },
  originalImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  originalImagesContainer: {
    marginTop: 8,
  },
  originalImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'space-between',
  },
  originalGridImage: {
    width: '49%',
    height: 150,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
    marginBottom: 2,
  },
  originalGridImageContent: {
    width: '100%',
    height: '100%',
  },
  originalMoreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  originalMoreImagesText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  countItem: {
    flex: 1,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  actionIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 6,
  },
  likedText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxWidth: 300,
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
  emptyText: { 
    color: '#666', 
    textAlign: 'center', 
    paddingVertical: 12
  },
  disabledText: {
    color: '#999',
    opacity: 0.6,
  },
  // Removed comment modal styles since we're using full-screen navigation
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  deleteButton: {
    backgroundColor: '#fee',
  },
  modalButtonText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  deleteButtonText: {
    color: '#dc3545',
  },
  editModalContent: {
    backgroundColor: '#fff',
    width: '90%',
    borderRadius: 16,
    padding: 0,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  editModalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  editModalSaveButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editModalSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  editModalInput: {
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  // Image Viewer Styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageViewerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 1,
  },
  imageViewerCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageViewerImage: {
    width: 400,
    height: 400,
  },
  repostUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  originalUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clickableName: {
    color: '#1e3a8a',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  adminBadge: {
    backgroundColor: '#dc2626', // Red for admin
  },
  pesoBadge: {
    backgroundColor: '#059669', // Green for peso
  },
  priorityBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  donationBadge: {
    backgroundColor: '#059669', // Green color for donation (matching web and dashboard)
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  donationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  eventBadge: {
    backgroundColor: '#3b82f6', // Blue color for event (matching web)
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  eventBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default RepostCard;

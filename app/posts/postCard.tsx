import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import CachedImage from '../../components/CachedImage';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { API_BASE_URL, likePost, unlikePost, repostPost, deleteRepost, editPost, deletePost } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import { getImagesFromContent, getFirstImageUrl, hasImages } from '../../utils/imageUtils';
import { renderTextWithMentions } from '../../utils/mentionUtils';
import { screenWidth, screenHeight, wp, hp, getResponsiveFontSize, getResponsivePadding, getPercentageWidth } from '../../utils/responsive';
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

interface Props {
  post: Post;
  currentUserId?: number;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onOpenViewer?: (post: Post, type: 'likes' | 'comments' | 'reposts') => void;
  onEdited?: (postId: number, newContent: string) => void;
  onDeleted?: (postId: number) => void;
  onRepostToggle?: (postId: number, isReposted: boolean) => void;
}

const PostCard: React.FC<Props> = ({ post, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted, onRepostToggle }) => {
  const router = useRouter();

  // Local state
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0);
  const [showActions, setShowActions] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editContent, setEditContent] = useState(post.post_content);
  const [editLoading, setEditLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const imageScrollRef = React.useRef<ScrollView>(null);

  // Update edit content when post content changes
  useEffect(() => {
    setEditContent(post.post_content);
  }, [post.post_content]);

  // Sync like state and repost count when post data changes
  useEffect(() => {
    let liked: any = post.is_liked;
    if ((liked === undefined || liked === null) && currentUserId && Array.isArray((post as any).likes)) {
      liked = (post as any).likes.some((l: any) => (l?.user_id || l?.user?.user_id) === currentUserId);
    }
    setIsLiked(Boolean(liked));
    setLikeCount(post.likes_count || 0);
    setRepostCount(post.reposts_count || 0);
  }, [post.is_liked, post.likes_count, post.reposts_count, (post as any).likes, currentUserId]);

  const userName = formatUserFullName(post.user);
  
  // Check if user is admin or peso for priority display
  const userType = post.user?.account_type || post.user?.user_type || 'user';
  const isAdmin = userType === 'admin';
  const isPeso = userType === 'peso';
  const isPriorityUser = isAdmin || isPeso;

  // Use utility functions for image handling
  const images = getImagesFromContent(post);
  const imageUrl = getFirstImageUrl(post);

  // Debug logging for images
  console.log('=== POST CARD DEBUG ===');
  console.log('PostCard - Post ID:', post.post_id);
  console.log('PostCard - Post image field:', post.post_image);
  console.log('PostCard - Post images array:', post.post_images);
  console.log('PostCard - Post images field type:', typeof post.post_images);
  console.log('PostCard - Post images field length:', post.post_images?.length);
  console.log('PostCard - Processed images:', images);
  console.log('PostCard - Processed images length:', images.length);
  console.log('PostCard - Constructed imageUrl:', imageUrl);
  console.log('PostCard - Full post object keys:', Object.keys(post));
  console.log('PostCard - Images condition check:', images.length > 0);
  console.log('=== END POST CARD DEBUG ===');

  /** --- Actions --- **/
  const handleLike = async () => {
    try {
      if (isLiked) {
        await unlikePost(post.post_id);
        setIsLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
        onLikeToggle?.(post.post_id, false);
      } else {
        await likePost(post.post_id);
        setIsLiked(true);
        setLikeCount((c) => c + 1);
        onLikeToggle?.(post.post_id, true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update like.');
    }
  };

  const handleRepost = async () => {
    console.log('PostCard - handleRepost called');
    console.log('PostCard - post.post_id:', post.post_id);
    console.log('PostCard - post:', post);
    
    // Validate post ID
    if (!post.post_id) {
      Alert.alert('Error', 'Invalid post ID. Cannot repost this post.');
      return;
    }

    // Check if current user already reposted this post
    const meId = currentUserId;
    const alreadyReposted = Array.isArray(post.reposts) 
      ? post.reposts.find((r: any) => r.user?.user_id === meId)
      : null;
    
    console.log('PostCard - alreadyReposted:', alreadyReposted);
    
    if (alreadyReposted) {
      Alert.alert(
        'Already Reposted',
        'You have already reposted this post. Would you like to edit your repost?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Edit Repost', 
            onPress: () => {
              console.log('PostCard - Navigating to repost screen for edit with postId:', post.post_id);
              router.push(`/repost/repost?postId=${post.post_id}`);
              // Note: Repost count will be updated when the user returns to this screen
            }
          }
        ]
      );
    } else {
      // Navigate to repost screen so user can add an optional caption
      console.log('PostCard - Navigating to repost screen with postId:', post.post_id);
      router.push(`/repost/repost?postId=${post.post_id}`);
      // Note: Repost count will be updated when the user returns to this screen
    }
  };

  const handleDelete = async () => {
    setShowActions(false);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deletePost(post.post_id);
              if (response.success !== false) {
                Alert.alert('Success', 'Post deleted successfully.');
                setShowActions(false);
                onDeleted?.(post.post_id);
              } else {
                Alert.alert('Error', response.message || 'Failed to delete post.');
              }
            } catch (error: any) {
              console.error('Delete post error:', error);
              Alert.alert('Error', error?.response?.data?.error || error?.message || 'Could not delete post.');
            }
          }
        }
      ]
    );
  };

  const handleEdit = async () => {
    if (!editContent.trim()) {
      Alert.alert('Error', 'Post content cannot be empty.');
      return;
    }

    if (editLoading) return;

    try {
      setEditLoading(true);
      const response = await editPost(post.post_id, { post_content: editContent.trim() });
      if (response.success !== false) {
        Alert.alert('Success', 'Post updated successfully.');
        setEditModal(false);
        onEdited?.(post.post_id, editContent.trim());
      } else {
        Alert.alert('Error', response.message || 'Failed to update post.');
      }
    } catch (error: any) {
      console.error('Edit post error:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Could not update post.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <TouchableOpacity
          onPress={() => {
            const uid = post.user?.user_id;
            if (uid) {
              router.push(`/profile/profilepage?viewUserId=${uid}`);
            }
          }}
          disabled={!post.user?.user_id}
          style={styles.userContainer}
        >
          <UserAvatar 
            profilePic={post.user?.profile_pic}
            firstName={post.user?.f_name}
            lastName={post.user?.l_name}
            size={40}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.nameContainer}>
              <Text style={[
                styles.name,
                (post.user?.user_id && post.user?.user_id !== currentUserId) ? styles.clickableName : null
              ]}>{userName}</Text>
              {isPriorityUser && (
                <View style={[
                  styles.priorityBadge,
                  isAdmin ? styles.adminBadge : styles.pesoBadge
                ]}>
                  <Text style={styles.priorityBadgeText}>
                    {isAdmin ? 'ADMIN' : 'PESO'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.meta}>{dayjs(post.created_at).fromNow()}</Text>
          </View>
        </TouchableOpacity>
        {currentUserId === post.user?.user_id && (
          <TouchableOpacity
            onPress={() => setShowActions(true)}
            style={{ padding: 6 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome name="ellipsis-h" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {post.post_title && <Text style={styles.postTitle}>{post.post_title}</Text>}
      <Text style={styles.content}>
        {renderTextWithMentions(post.post_content, [], (userId) => {
          router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
        })}
      </Text>
      {/* Images - Facebook-style grid layout like web */}
      {images.length > 0 && (
        <View style={styles.imagesContainer}>
          {images.length === 1 ? (
            // Single image - full width
            <TouchableOpacity 
              onPress={() => {
                setSelectedImageIndex(0);
                setImageViewerVisible(true);
              }}
            >
          <CachedImage 
            uri={imageUrl || ''} 
            style={styles.singleImage} 
            contentFit="cover" 
          />
            </TouchableOpacity>
          ) : (
            // Multiple images - Facebook-style grid layout
            <View style={styles.imagesGrid}>
              {images.slice(0, 4).map((image, index) => {
                // Determine grid style based on image count and position
                let gridStyle = styles.gridImageContainer;
                if (images.length === 2) {
                  gridStyle = styles.twoImagesGrid;
                } else if (images.length === 3) {
                  // For 3 images: first image takes full width on top, other 2 share bottom row
                  if (index === 0) {
                    gridStyle = styles.threeImagesFirst;
                  } else {
                    gridStyle = styles.threeImagesRest;
                  }
                } else if (images.length === 4) {
                  gridStyle = styles.fourImagesGrid;
                } else if (images.length >= 5) {
                  gridStyle = styles.fourImagesGrid;
                }
                
                return (
                  <TouchableOpacity 
                    key={index}
                    style={[gridStyle, { marginBottom: 2 }]}
                    onPress={() => {
                      setSelectedImageIndex(index);
                      setImageViewerVisible(true);
                    }}
                  >
                  <CachedImage 
                    uri={String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}`} 
                    style={styles.gridImage} 
                    contentFit="cover" 
                  />
                  {/* Show "+X more" overlay for the 4th image if there are more than 4 */}
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
      )}

      {/* Stats */}
      <View style={styles.actionsCountsRow}>
        <TouchableOpacity onPress={() => onOpenViewer?.(post, 'likes')}>
          <Text style={styles.countText}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}>
          <Text style={styles.countText}>{post.comments_count || 0} comments</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOpenViewer?.(post, 'reposts')}>
          <Text style={styles.countText}>{repostCount} reposts</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionIcon} onPress={handleLike}>
          <FontAwesome
            name={isLiked ? 'thumbs-up' : 'thumbs-o-up'}
            size={18}
            color={isLiked ? '#1e3a8a' : '#555'}
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionIcon}
          onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}
        >
          <FontAwesome name="comment-o" size={20} color="#555" />
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
                setEditModal(true);
                setShowActions(false);
              }}
            >
              <FontAwesome name="pencil" size={18} color="#374151" style={{ marginRight: 8 }} />
              <Text style={styles.sheetRowText}>Edit Post</Text>
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
              <Text style={[styles.sheetRowText, { color: '#dc2626' }]}>Delete Post</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowActions(false)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <TouchableOpacity onPress={() => setEditModal(false)} style={styles.editModalCloseButton}>
                <FontAwesome name="times" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.editModalTitle}>Edit Post</Text>
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
              value={editContent}
              onChangeText={setEditContent}
              placeholder="What's happening?"
              multiline
              maxLength={500}
            />
          </View>
        </View>
      </Modal>

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
            {images.length > 1 && (
              <View style={styles.imageViewerCounter}>
                <Text style={styles.imageViewerCounterText}>
                  {selectedImageIndex + 1} of {images.length}
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
              {images.map((image, index) => (
                <View key={index} style={{ width: screenWidth, height: screenHeight, justifyContent: 'center', alignItems: 'center' }}>
                  <CachedImage
                    uri={String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}`}
                    style={styles.imageViewerImage}
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

export default PostCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: getResponsivePadding(16),
    marginTop: hp(16),
    marginBottom: hp(8),
    borderRadius: wp(16),
    elevation: 2,
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
    marginBottom: hp(10),
  },
  avatar: {
    width: wp(40),
    height: wp(40),
    borderRadius: wp(20),
    marginRight: wp(10),
    backgroundColor: '#ccc',
  },
  name: { fontWeight: 'bold', fontSize: getResponsiveFontSize(14) },
  meta: { fontSize: getResponsiveFontSize(12), color: '#666' },
  postTitle: { fontSize: getResponsiveFontSize(18), fontWeight: 'bold', marginTop: hp(10), color: '#333' },
  content: { fontSize: getResponsiveFontSize(14), marginTop: hp(10), color: '#333' },
  postImage: { width: wp(200), height: wp(200), borderRadius: wp(10), marginTop: hp(10), marginRight: wp(10), backgroundColor: '#ccc' },
  imagesContainer: {
    marginTop: hp(10),
    borderRadius: wp(8),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: wp(8),
    alignSelf: 'center',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
    justifyContent: 'space-between',
  },
  // Facebook-style grid layouts
  twoImagesGrid: {
    width: '49%',
    height: hp(200),
    position: 'relative',
    overflow: 'hidden',
    borderRadius: wp(4),
  },
  threeImagesGrid: {
    // Container style - individual images have their own styles
  },
  fourImagesGrid: {
    width: '49%',
    height: hp(150),
    position: 'relative',
    overflow: 'hidden',
    borderRadius: wp(4),
  },
  fivePlusImagesGrid: {
    width: '49%',
    height: hp(120),
    position: 'relative',
    overflow: 'hidden',
    borderRadius: wp(4),
  },
  gridImageContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: wp(4),
  },
  threeImagesFirst: {
    width: '100%',
    height: hp(200),
    position: 'relative',
    overflow: 'hidden',
    borderRadius: wp(4),
    marginBottom: hp(2),
  },
  threeImagesRest: {
    width: '49%',
    height: hp(100),
    position: 'relative',
    overflow: 'hidden',
    borderRadius: wp(4),
  },
  gridImage: {
    width: '100%',
    height: '100%',
    minHeight: hp(100),
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
    fontSize: getResponsiveFontSize(20),
    fontWeight: 'bold',
  },
  imagesScroll: {
    maxHeight: hp(200),
  },
  actionsCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp(8),
    marginTop: hp(8),
  },
  countText: { fontSize: getResponsiveFontSize(12), color: '#666' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: hp(15),
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: hp(10),
  },
  actionIcon: { alignItems: 'center', gap: wp(2) },
  actionText: { fontSize: getResponsiveFontSize(12), color: '#555' },
  likedText: { color: '#1e3a8a', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: getPercentageWidth(90), borderRadius: wp(12), padding: getResponsivePadding(20) },
  modalTitle: { fontSize: getResponsiveFontSize(16), fontWeight: 'bold', marginBottom: hp(12) },
  modalButton: { padding: getResponsivePadding(12), borderRadius: wp(8), marginVertical: hp(6), backgroundColor: '#1e3a8a' },
  modalButtonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: wp(8), padding: getResponsivePadding(10), minHeight: hp(80), textAlignVertical: 'top' },
  button: { backgroundColor: '#1e3a8a', borderRadius: wp(8), padding: getResponsivePadding(12), marginVertical: hp(6) },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  // Unified Action Sheet styles
  sheet: {
    backgroundColor: '#fff',
    width: getPercentageWidth(88),
    borderRadius: wp(16),
    paddingVertical: hp(8),
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
  },
  sheetRowText: {
    fontSize: getResponsiveFontSize(16),
    color: '#111827',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  sheetCancel: {
    marginTop: hp(10),
    backgroundColor: '#fff',
    borderRadius: wp(16),
    width: getPercentageWidth(88),
    paddingVertical: hp(14),
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: getResponsiveFontSize(16),
    color: '#6b7280',
    fontWeight: '500',
  },
  
  // Standardized Edit Modal Styles
  editModalContent: {
    backgroundColor: '#fff',
    width: getPercentageWidth(90),
    borderRadius: wp(16),
    padding: 0,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  editModalCloseButton: {
    padding: wp(8),
    borderRadius: wp(20),
    backgroundColor: '#f3f4f6',
  },
  editModalTitle: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '700',
    color: '#111827',
  },
  editModalSaveButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: wp(16),
    paddingVertical: hp(8),
    borderRadius: wp(20),
  },
  editModalSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: getResponsiveFontSize(14),
  },
  editModalInput: {
    padding: wp(16),
    fontSize: getResponsiveFontSize(16),
    color: '#111827',
    minHeight: hp(120),
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
    top: hp(60),
    right: wp(20),
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: wp(20),
    width: wp(40),
    height: wp(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(20),
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
    top: hp(50),
    left: wp(20),
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: wp(15),
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    zIndex: 1,
  },
  imageViewerCounterText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(14),
    fontWeight: 'bold',
  },
  imageViewerImage: {
    width: '100%',
    height: '80%',
  },
  userContainer: {
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
    paddingHorizontal: wp(6),
    paddingVertical: hp(2),
    borderRadius: wp(10),
    marginLeft: wp(8),
  },
  adminBadge: {
    backgroundColor: '#dc2626', // Red for admin
  },
  pesoBadge: {
    backgroundColor: '#059669', // Green for peso
  },
  priorityBadgeText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(10),
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE_URL, likeForumPost, unlikeForumPost, repostForumPost, deleteForumPost, editForumPost, followUser, unfollowUser, checkFollowStatus } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

interface Post {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  post_images?: any[];
  type?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  user: { user_id: number; f_name: string; l_name: string; profile_pic?: string | null };
}

interface Props {
  post: Post;
  currentUserId?: number;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onOpenViewer?: (post: Post, type: 'likes' | 'comments' | 'reposts') => void;
  onEdited?: (postId: number, newContent: string) => void;
  onDeleted?: (postId: number) => void;
  onCommentCountUpdate?: (postId: number, newCount: number) => void;
}

const ForumPostCard: React.FC<Props> = ({ post, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted, onCommentCountUpdate }) => {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0);
  const [commentCount, setCommentCount] = useState(post.comments_count || 0);
  const [showActions, setShowActions] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editContent, setEditContent] = useState(post.post_content);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowButton, setShowFollowButton] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const userName = `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User';

  // Handle both single image and multiple images
  const getImagesFromPost = (post: any) => {
    const images = [];
    
    // Add main post image if exists (backward compatibility)
    if (post.post_image) {
      images.push({
        image_id: 0,
        image_url: post.post_image,
        order: 0
      });
    }
    
    // Add post_images array if exists (multiple images)
    if (post.post_images && Array.isArray(post.post_images)) {
      images.push(...post.post_images);
    }
    
    return images.sort((a, b) => a.order - b.order);
  };

  const images = getImagesFromPost(post);
  const imageUrl = images.length > 0 
    ? (String(images[0].image_url).startsWith('http') ? images[0].image_url : `${API_BASE_URL}${images[0].image_url}`)
    : null;

  // Debug logging for image
  console.log('ForumPostCard - Post ID:', post.post_id);
  console.log('ForumPostCard - Post image field:', post.post_image);
  console.log('ForumPostCard - Constructed imageUrl:', imageUrl);

  // Check follow status when component mounts
  useEffect(() => {
    const checkFollow = async () => {
      if (currentUserId && post.user?.user_id && currentUserId !== post.user.user_id) {
        try {
          const status = await checkFollowStatus(post.user.user_id);
          setIsFollowing(status.is_following || false);
          setShowFollowButton(true);
        } catch (error) {
          console.error('Error checking follow status:', error);
          setShowFollowButton(true); // Show button anyway, let user try
        }
      }
    };
    checkFollow();
  }, [currentUserId, post.user?.user_id]);

  // Update comment count when post prop changes
  useEffect(() => {
    setCommentCount(post.comments_count || 0);
  }, [post.comments_count]);

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

  /** --- Navigation --- **/
  const handleUserPress = () => {
    if (post.user?.user_id) {
      router.push(`/otheruser/otheruser?viewUserId=${post.user.user_id}`);
    }
  };

  /** --- Follow Actions --- **/
  const handleFollow = async () => {
    if (!post.user?.user_id || followLoading) return;
    
    try {
      setFollowLoading(true);
      if (isFollowing) {
        await unfollowUser(post.user.user_id);
        setIsFollowing(false);
      } else {
        await followUser(post.user.user_id);
        setIsFollowing(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  /** --- Actions --- **/
  const handleLike = async () => {
    try {
      if (isLiked) {
        await unlikeForumPost(post.post_id);
        setIsLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
        onLikeToggle?.(post.post_id, false);
      } else {
        await likeForumPost(post.post_id);
        setIsLiked(true);
        setLikeCount((c) => c + 1);
        onLikeToggle?.(post.post_id, true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update like.');
    }
  };

  const handleRepost = async () => {
    if (!post.post_id) {
      Alert.alert('Error', 'Invalid post ID. Cannot repost this post.');
      return;
    }

    try {
      console.log('ForumPostCard - Reposting forum post with ID:', post.post_id);
      const response = await repostForumPost(post.post_id);
      console.log('ForumPostCard - Repost response:', response);
      
      if (response.success !== false) {
        setRepostCount((c) => c + 1);
        Alert.alert('Success', 'Post reposted successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to repost');
      }
    } catch (error: any) {
      console.error('ForumPostCard - Repost error:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to repost');
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
              const response = await deleteForumPost(post.post_id);
              if (response.success !== false) {
                Alert.alert('Success', 'Post deleted successfully.');
                setShowActions(false);
                onDeleted?.(post.post_id);
              } else {
                Alert.alert('Error', response.message || 'Failed to delete post.');
              }
            } catch (error: any) {
              console.error('Delete forum post error:', error);
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

    try {
      const response = await editForumPost(post.post_id, { post_content: editContent.trim() });
      if (response.success !== false) {
        Alert.alert('Success', 'Post updated successfully.');
        setEditModal(false);
        onEdited?.(post.post_id, editContent.trim());
      } else {
        Alert.alert('Error', response.message || 'Failed to update post.');
      }
    } catch (error: any) {
      console.error('Edit forum post error:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Could not update post.');
    }
  };


  return (
    <>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <TouchableOpacity onPress={handleUserPress} style={styles.userInfo}>
            <UserAvatar 
              profilePic={post.user?.profile_pic}
              firstName={post.user?.f_name}
              lastName={post.user?.l_name}
              size={40}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{userName}</Text>
              <Text style={styles.meta}>{formatDate(post.created_at)}</Text>
            </View>
          </TouchableOpacity>
          
          {/* Follow button for other users */}
          {showFollowButton && currentUserId !== post.user?.user_id && (
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? "#fff" : "#174f84"} />
              ) : (
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* Actions menu for own posts */}
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
        <Text style={styles.content}>{post.post_content}</Text>
        
        {/* Images - support multiple images */}
        {images.length > 0 && (
          <View style={styles.imagesContainer}>
            {images.length === 1 ? (
              <TouchableOpacity 
                onPress={() => setImageViewerVisible(true)}
              >
                <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal style={styles.imagesScroll} showsHorizontalScrollIndicator={false}>
                {images.map((image, index) => (
                  <TouchableOpacity 
                    key={index}
                    onPress={() => setImageViewerVisible(true)}
                  >
                    <Image 
                      source={{ uri: String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}` }} 
                      style={styles.postImage} 
                      resizeMode="cover" 
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.actionsCountsRow}>
          <TouchableOpacity onPress={() => onOpenViewer?.(post, 'likes')}>
            <Text style={styles.countText}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${post.post_id}&isForumPost=true`)}>
            <Text style={styles.countText}>{commentCount} comments</Text>
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

          <TouchableOpacity style={styles.actionIcon} onPress={() => router.push(`/posts/comments?postId=${post.post_id}&isForumPost=true`)}>
            <FontAwesome name="comment-o" size={18} color="#555" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionIcon} onPress={handleRepost}>
            <FontAwesome name="retweet" size={18} color="#555" />
            <Text style={styles.actionText}>Repost</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Sheet Modal */}
      <Modal visible={showActions} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowActions(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setEditModal(true);
                setShowActions(false);
              }}
            >
              <Text style={styles.modalButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: 'red' }]}
              onPress={handleDelete}
            >
              <Text style={styles.modalButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Post</Text>
            <TextInput
              style={styles.input}
              value={editContent}
              onChangeText={setEditContent}
              multiline
            />
            <TouchableOpacity style={styles.button} onPress={handleEdit}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: 'gray' }]}
              onPress={() => setEditModal(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
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
            <Image
              source={{ uri: imageUrl }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ForumPostCard;

const styles = StyleSheet.create({
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  followButton: {
    backgroundColor: '#e3ecf7',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#174f84',
    marginLeft: 8,
  },
  followingButton: {
    backgroundColor: '#174f84',
    borderColor: '#174f84',
  },
  followButtonText: {
    color: '#174f84',
    fontSize: 12,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#fff',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  name: { fontWeight: 'bold', fontSize: 14 },
  meta: { fontSize: 12, color: '#666' },
  postTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10, color: '#333' },
  content: { fontSize: 14, marginTop: 10, color: '#333' },
  postImage: { width: '100%', height: 200, borderRadius: 10, marginTop: 10, backgroundColor: '#ccc' },
  actionsCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  countText: { fontSize: 12, color: '#666' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  actionIcon: { alignItems: 'center', gap: 2 },
  actionText: { fontSize: 12, color: '#555' },
  likedText: { color: '#1e3a8a', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '90%', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  modalButton: { padding: 12, borderRadius: 8, marginVertical: 6, backgroundColor: '#1e3a8a' },
  modalButtonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#1e3a8a', borderRadius: 8, padding: 12, marginVertical: 6 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
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
  imageViewerImage: {
    width: 400,
    height: 400,
  },
  imagesContainer: {
    marginTop: 10,
  },
  imagesScroll: {
    maxHeight: 200,
  },
});

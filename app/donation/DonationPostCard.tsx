import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { API_BASE_URL, likeDonationPost, unlikeDonationPost, commentOnDonationPost, getDonationDetail, repostDonationPost, deleteDonationPost, editDonationPost, followUser, unfollowUser, checkFollowStatus, getUserInfo } from '../../services/api';
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
  onRepostToggle?: (postId: number, isReposted: boolean) => void;
}

const DonationPostCard: React.FC<Props> = ({ post, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted, onRepostToggle }) => {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0);
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


  const handleLike = async () => {
    try {
      if (isLiked) {
        await unlikeDonationPost(post.post_id);
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
        onLikeToggle?.(post.post_id, false);
      } else {
        await likeDonationPost(post.post_id);
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
        onLikeToggle?.(post.post_id, true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleRepost = async () => {
    if (!post.post_id) {
      Alert.alert('Error', 'Invalid post ID. Cannot repost this post.');
      return;
    }

    try {
      console.log('DonationPostCard - Reposting donation post with ID:', post.post_id);
      const response = await repostDonationPost(post.post_id);
      console.log('DonationPostCard - Repost response:', response);
      
      if (response.success !== false) {
        setRepostCount(prev => prev + 1);
        onRepostToggle?.(post.post_id, true);
        Alert.alert('Success', 'Post reposted successfully!');
      } else {
        Alert.alert('Error', response.message || 'Failed to repost');
      }
    } catch (error: any) {
      console.error('Error reposting:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to repost');
    }
  };

  const handleDelete = () => {
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
              const response = await deleteDonationPost(post.post_id);
              if (response.success !== false) {
                Alert.alert('Success', 'Post deleted successfully.');
                onDeleted?.(post.post_id);
              } else {
                Alert.alert('Error', response.message || 'Failed to delete post.');
              }
            } catch (error: any) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleEdit = async () => {
    if (!editContent.trim()) {
      Alert.alert('Error', 'Post content cannot be empty.');
      return;
    }

    try {
      const response = await editDonationPost(post.post_id, { description: editContent.trim() });
      if (response.success !== false) {
        Alert.alert('Success', 'Post updated successfully.');
        setEditModal(false);
        onEdited?.(post.post_id, editContent.trim());
      } else {
        Alert.alert('Error', response.message || 'Failed to update post.');
      }
    } catch (error: any) {
      console.error('Error editing post:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to edit post');
    }
  };


  const handleFollow = async () => {
    if (followLoading) return;
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(post.user.user_id);
        setIsFollowing(false);
      } else {
        await followUser(post.user.user_id);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserId && post.user.user_id !== currentUserId) {
      setShowFollowButton(true);
      checkFollowStatus(post.user.user_id).then(status => {
        setIsFollowing(status.is_following || false);
      }).catch(() => {
        setIsFollowing(false);
      });
    }
  }, [currentUserId, post.user.user_id]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <UserAvatar 
          profilePic={post.user?.profile_pic}
          firstName={post.user?.f_name}
          lastName={post.user?.l_name}
          size={40}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.meta}>{dayjs(post.created_at).fromNow()}</Text>
        </View>
        {currentUserId === post.user.user_id && (
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
              <Image source={{ uri: imageUrl }} style={styles.postImage} />
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
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Stats */}
      <View style={styles.actionsCountsRow}>
        <TouchableOpacity onPress={() => onOpenViewer?.(post as any, 'likes')}>
          <Text style={styles.countText}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${post.post_id}&isDonationPost=true`)}>
          <Text style={styles.countText}>{post.comments_count || 0} comments</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOpenViewer?.(post as any, 'reposts')}>
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
          onPress={() => router.push(`/posts/comments?postId=${post.post_id}&isDonationPost=true`)}
        >
          <FontAwesome name="comment-o" size={20} color="#555" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionIcon} onPress={handleRepost}>
          <FontAwesome name="retweet" size={18} color="#555" />
          <Text style={styles.actionText}>Repost</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.modalTitle}>Edit Post</Text>
            <TextInput
              style={styles.editInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              placeholder="What's happening?"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleEdit}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Actions Modal */}
      <Modal visible={showActions} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionsModal}>
            <TouchableOpacity style={styles.actionOption} onPress={() => { setShowActions(false); setEditModal(true); }}>
              <FontAwesome name="edit" size={20} color="#666" />
              <Text style={styles.actionOptionText}>Edit Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionOption, styles.deleteOption]} onPress={() => { setShowActions(false); handleDelete(); }}>
              <FontAwesome name="trash" size={20} color="#e74c3c" />
              <Text style={[styles.actionOptionText, styles.deleteText]}>Delete Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelOption} onPress={() => setShowActions(false)}>
              <Text style={styles.cancelOptionText}>Cancel</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
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
    marginBottom: 10,
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
  postImage: { width: 200, height: 200, borderRadius: 10, marginTop: 10, marginRight: 10, backgroundColor: '#ccc' },
  imagesContainer: {
    marginTop: 10,
  },
  imagesScroll: {
    maxHeight: 200,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  actionsModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#174f84',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deleteOption: {
    borderBottomWidth: 0,
  },
  actionOptionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  deleteText: {
    color: '#e74c3c',
  },
  cancelOption: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelOptionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
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
  imageViewerImage: {
    width: 400,
    height: 400,
  },
});

export default DonationPostCard;

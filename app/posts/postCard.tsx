import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { API_BASE_URL, likePost, unlikePost, repostPost, deleteRepost, editPost, deletePost } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

interface Post {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id?: number;
  };
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  created_at: string;
  is_liked?: boolean;
}

interface Props {
  post: Post;
  currentUserId?: number;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onOpenViewer?: (post: Post, type: 'likes' | 'comments' | 'reposts') => void;
  onEdited?: (postId: number, newContent: string) => void;
  onDeleted?: (postId: number) => void;
}

const PostCard: React.FC<Props> = ({ post, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted }) => {
  const router = useRouter();

  // Local state
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0);
  const [showActions, setShowActions] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editContent, setEditContent] = useState(post.post_content);

  const userName = `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User';

  const imageUrl = post.post_image
    ? (String(post.post_image).startsWith('http') ? post.post_image : `${API_BASE_URL}${post.post_image}`)
    : null;

  // Debug logging for image
  console.log('PostCard - Post ID:', post.post_id);
  console.log('PostCard - Post image field:', post.post_image);
  console.log('PostCard - Constructed imageUrl:', imageUrl);

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
    // Check if current user already reposted this post
    const meId = currentUserId;
    const alreadyReposted = Array.isArray(post.reposts) 
      ? post.reposts.find((r: any) => r.user?.user_id === meId)
      : null;
    
    if (alreadyReposted) {
      Alert.alert(
        'Already Reposted',
        'You have already reposted this post. Would you like to edit your repost?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Edit Repost', 
            onPress: () => router.push(`/repost/repost?postId=${post.post_id}`)
          }
        ]
      );
    } else {
      // Navigate to repost screen so user can add an optional caption
      router.push(`/repost/repost?postId=${post.post_id}`);
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
              await deletePost(post.post_id);
              Alert.alert('Deleted', 'Post removed successfully.');
              setShowActions(false);
              onDeleted?.(post.post_id);
            } catch (error: any) {
              console.error('Delete post error:', error);
              console.error('Error details:', {
                message: error?.message,
                response: error?.response?.data,
                status: error?.response?.status
              });
              Alert.alert('Error', `Could not delete post: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const handleEdit = async () => {
    try {
      await editPost(post.post_id, { post_content: editContent });
      Alert.alert('Updated', 'Post updated successfully.');
      setEditModal(false);
      onEdited?.(post.post_id, editContent);
    } catch (error) {
      Alert.alert('Error', 'Could not update post.');
    }
  };

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
      {imageUrl && <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />}

      {/* Stats */}
      <View style={styles.actionsCountsRow}>
        <TouchableOpacity onPress={() => onOpenViewer?.(post, 'likes')}>
          <Text style={styles.countText}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}>
          <Text style={styles.countText}>{post.comments_count || 0} comments</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOpenViewer?.(post, 'reposts')}>
          <Text style={styles.countText}>{repostCount} shares</Text>
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
          <FontAwesome name="comment-o" size={18} color="#555" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionIcon} onPress={handleRepost}>
          <FontAwesome name="retweet" size={18} color="#555" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
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
    </View>
  );
};

export default PostCard;

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
});

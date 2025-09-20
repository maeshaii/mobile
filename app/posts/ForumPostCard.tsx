import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { API_BASE_URL, likeForumPost, unlikeForumPost, commentOnForumPost, getForumDetail, repostForumPost, deleteForumPost, editForumPost } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

interface Post {
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

interface Props {
  post: Post;
  currentUserId?: number;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onOpenViewer?: (post: Post, type: 'likes' | 'comments' | 'reposts') => void;
  onEdited?: (postId: number, newContent: string) => void;
  onDeleted?: (postId: number) => void;
}

const ForumPostCard: React.FC<Props> = ({ post, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted }) => {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0);
  const [showActions, setShowActions] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editContent, setEditContent] = useState(post.post_content);
  const [commentModal, setCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  const userName = `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User';

  const imageUrl = post.post_image
    ? (String(post.post_image).startsWith('http') ? post.post_image : `${API_BASE_URL}${post.post_image}`)
    : null;

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
    try {
      await repostForumPost(post.post_id);
      setRepostCount((c) => c + 1);
      Alert.alert('Reposted', 'Post reposted successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to repost');
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
              await deleteForumPost(post.post_id);
              Alert.alert('Deleted', 'Post removed successfully.');
              setShowActions(false);
              onDeleted?.(post.post_id);
            } catch (error) {
              Alert.alert('Error', 'Could not delete post.');
            }
          }
        }
      ]
    );
  };

  const handleEdit = async () => {
    try {
      await editForumPost(post.post_id, { post_content: editContent });
      Alert.alert('Updated', 'Post updated successfully.');
      setEditModal(false);
      onEdited?.(post.post_id, editContent);
    } catch (error) {
      Alert.alert('Error', 'Could not update post.');
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      await commentOnForumPost(post.post_id, commentText);
      
      // Refresh comments
      const detail = await getForumDetail(post.post_id);
      setComments(detail?.comments || []);
      
      setCommentText('');
      setCommentModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const openCommentModal = async () => {
    try {
      const detail = await getForumDetail(post.post_id);
      setComments(detail?.comments || []);
      setCommentModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to load comments');
    }
  };

  return (
    <>
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
            <Text style={styles.meta}>{formatDate(post.created_at)}</Text>
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
          <TouchableOpacity onPress={openCommentModal}>
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

          <TouchableOpacity style={styles.actionIcon} onPress={openCommentModal}>
            <FontAwesome name="comment-o" size={18} color="#555" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionIcon} onPress={handleRepost}>
            <FontAwesome name="retweet" size={18} color="#555" />
            <Text style={styles.actionText}>Share</Text>
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

      {/* Comment Modal */}
      <Modal visible={commentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.commentModalContent}>
            <View style={styles.commentModalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModal(false)}>
                <FontAwesome name="times" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.comment_id} style={styles.commentItem}>
                  <UserAvatar 
                    profilePic={comment.user?.profile_pic}
                    firstName={comment.user?.f_name}
                    lastName={comment.user?.l_name}
                    size={36}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentContent}>
                    <Text style={styles.commentAuthor}>
                      {comment.user?.f_name} {comment.user?.l_name}
                    </Text>
                    <Text style={styles.commentText}>{comment.comment_content}</Text>
                    <Text style={styles.commentDate}>
                      {formatDate(comment.date_created)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendCommentBtn, !commentText.trim() && styles.sendCommentBtnDisabled]}
                onPress={handleComment}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <FontAwesome name="send" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
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
  commentModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    width: '100%',
  },
  commentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  commentsList: {
    flex: 1,
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 12,
    color: '#888',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 80,
  },
  sendCommentBtn: {
    backgroundColor: '#1e3a8a',
    padding: 10,
    borderRadius: 20,
  },
  sendCommentBtnDisabled: {
    backgroundColor: '#ccc',
  },
});

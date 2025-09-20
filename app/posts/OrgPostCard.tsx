import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { commentOnPost, getPostComments, likePost, unlikePost } from '../../services/api';

interface Post {
  id: number;
  post_title: string;
  post_content: string;
  post_image?: string;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  comments: Comment[];
}

interface Comment {
  id: number;
  comment_content: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
}

interface OrgInfo {
  name: string;
  username: string;
  bio: string;
  profile_pic: any;
}

interface Props {
  post: Post;
  orgInfo: OrgInfo;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onCommentAdded?: (postId: number, comments: Comment[]) => void;
}

const OrgPostCard: React.FC<Props> = ({ post, orgInfo, onLikeToggle, onCommentAdded }) => {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState<Comment[]>(post.comments || []);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      if (isNaN(date.getTime())) {
        return 'Recently';
      }
      
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h`;
      if (diffInHours < 48) return '1d';
      return `${Math.floor(diffInHours / 24)}d`;
    } catch (error) {
      return 'Recently';
    }
  };

  const handleLike = async () => {
    try {
      if (isLiked) {
        await unlikePost(post.id);
        setIsLiked(false);
        setLikeCount(Math.max(0, likeCount - 1));
        onLikeToggle?.(post.id, false);
      } else {
        await likePost(post.id);
        setIsLiked(true);
        setLikeCount(likeCount + 1);
        onLikeToggle?.(post.id, true);
      }
    } catch (error) {
      console.error('Error liking/unliking post:', error);
      Alert.alert('Error', 'Failed to like/unlike post. Please try again.');
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      await commentOnPost(post.id, commentText);
      
      // Refresh comments for the post
      const updatedComments = await getPostComments(post.id);
      setComments(updatedComments);
      onCommentAdded?.(post.id, updatedComments);
      
      setCommentText('');
      setCommentModalVisible(false);
    } catch (error) {
      console.error('Error commenting:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const openCommentModal = () => {
    setCommentModalVisible(true);
  };

  const imageUrl = post.post_image
    ? (post.post_image.startsWith('http') 
        ? post.post_image 
        : `http://192.168.254.139:8000${post.post_image}`)
    : null;

  return (
    <>
      <View style={styles.postCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Image source={orgInfo.profile_pic} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.postName}>{orgInfo.name}</Text>
            <Text style={styles.postMeta}>
              {formatDate(post.created_at)} • <FontAwesome name="globe" size={12} color="#888" />
            </Text>
          </View>
        </View>
        <Text style={styles.postTitle}>{post.post_title}</Text>
        <Text style={styles.postContent}>{post.post_content}</Text>
        {imageUrl && (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.postImage} 
          />
        )}
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={handleLike}
          >
            <FontAwesome 
              name={isLiked ? "heart" : "heart-o"} 
              size={16} 
              color={isLiked ? "#e74c3c" : "#888"} 
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {likeCount} Like{likeCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={openCommentModal}
          >
            <FontAwesome name="comment-o" size={16} color="#888" />
            <Text style={styles.actionText}>
              {comments.length} Comment{comments.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Show recent comments */}
        {comments && comments.length > 0 && (
          <View style={styles.commentsSection}>
            {comments.slice(0, 2).map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <Text style={styles.commentAuthor}>
                  {comment.user.first_name} {comment.user.last_name}:
                </Text>
                <Text style={styles.commentText}>{comment.comment_content}</Text>
              </View>
            ))}
            {comments.length > 2 && (
              <TouchableOpacity onPress={openCommentModal}>
                <Text style={styles.viewMoreComments}>
                  View all {comments.length} comments
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <FontAwesome name="times" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.id} style={styles.modalCommentItem}>
                  <Text style={styles.modalCommentAuthor}>
                    {comment.user.first_name} {comment.user.last_name}
                  </Text>
                  <Text style={styles.modalCommentText}>{comment.comment_content}</Text>
                  <Text style={styles.modalCommentDate}>
                    {formatDate(comment.created_at)}
                  </Text>
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

export default OrgPostCard;

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  postName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
  },
  postMeta: {
    fontSize: 12,
    color: '#888',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 8,
    marginBottom: 4,
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 4,
  },
  likedText: {
    color: '#e74c3c',
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  commentItem: {
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#222',
  },
  commentText: {
    fontSize: 12,
    color: '#333',
  },
  viewMoreComments: {
    fontSize: 12,
    color: '#174f84',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  commentsList: {
    flex: 1,
    padding: 16,
  },
  modalCommentItem: {
    marginBottom: 16,
  },
  modalCommentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  modalCommentText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  modalCommentDate: {
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
    backgroundColor: '#174f84',
    padding: 10,
    borderRadius: 20,
  },
  sendCommentBtnDisabled: {
    backgroundColor: '#ccc',
  },
});

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { API_BASE_URL, likeRepost, unlikeRepost, repostPost, deleteRepost, updateRepost } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

interface OriginalPost {
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
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  created_at: string;
  is_liked?: boolean;
}

interface Repost {
  repost_id: number;
  caption?: string;
  created_at: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id?: number;
  };
  original_post: OriginalPost;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
}

interface Props {
  repost: Repost;
  currentUserId?: number;
  onLikeToggle?: (repostId: number, isLiked: boolean) => void;
  onOpenViewer?: (repost: Repost, type: 'likes' | 'comments' | 'reposts') => void;
  onEdited?: (repostId: number, newCaption: string) => void;
  onDeleted?: (repostId: number) => void;
}

const RepostCard: React.FC<Props> = ({ repost, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted }) => {
  const router = useRouter();

  // Local state for repost actions
  const [isLiked, setIsLiked] = useState(repost.is_liked || false);
  const [likeCount, setLikeCount] = useState(repost.likes_count || 0);
  const [repostCount, setRepostCount] = useState(repost.reposts_count || 0);
  const [showActions, setShowActions] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState(repost.caption || '');
  const [editLoading, setEditLoading] = useState(false);

  const repostUserName = `${repost.user?.f_name || ''} ${repost.user?.l_name || ''}`.trim() || 'User';
  const originalUserName = `${repost.original_post.user?.f_name || ''} ${repost.original_post.user?.l_name || ''}`.trim() || 'User';

  const originalImageUrl = repost.original_post.post_image
    ? (String(repost.original_post.post_image).startsWith('http') ? repost.original_post.post_image : `${API_BASE_URL}${repost.original_post.post_image}`)
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
      } else {
        await likeRepost(repost.repost_id);
      }
      
      console.log('Successfully updated repost like status');
    } catch (error) {
      console.error('Error liking repost:', error);
      console.error('Repost ID:', repost.repost_id);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Revert optimistic update on error
      setIsLiked(isLiked);
      setLikeCount((c) => Math.max(0, c + (isLiked ? 1 : -1)));
      onLikeToggle?.(repost.repost_id, isLiked);
      
      Alert.alert('Error', 'Repost likes are not yet supported. This feature is coming soon!');
    }
  };

  const handleRepost = async () => {
    // Navigate to repost screen for the original post
    router.push(`/posts/repost?postId=${repost.original_post.post_id}`);
  };

  const handleOriginalPostPress = () => {
    console.log('RepostCard - Original post data:', repost.original_post);
    console.log('RepostCard - Original post ID:', repost.original_post.post_id);
    console.log('RepostCard - Navigating to:', `/posts/detail?postId=${repost.original_post.post_id}`);
    router.push(`/posts/detail?postId=${repost.original_post.post_id}`);
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Repost',
      'Are you sure you want to delete this repost?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRepost(repost.repost_id);
              onDeleted?.(repost.repost_id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete repost.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = async () => {
    if (editLoading) return;
    
    try {
      setEditLoading(true);
      await updateRepost(repost.repost_id, editCaption.trim());
      onEdited?.(repost.repost_id, editCaption.trim());
      setEditModal(false);
      Alert.alert('Success', 'Repost caption updated successfully!');
    } catch (error) {
      console.error('Error editing repost:', error);
      Alert.alert('Error', 'Failed to edit repost caption.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Repost Header */}
      <View style={styles.repostHeader}>
        <UserAvatar 
          profilePic={repost.user?.profile_pic}
          firstName={repost.user?.f_name}
          lastName={repost.user?.l_name}
          size={24}
          style={styles.headerAvatar}
        />
        <Text style={styles.repostText}>{repostUserName} reposted</Text>
        <Text style={styles.repostMeta}>{dayjs(repost.created_at).fromNow()}</Text>
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

      {/* Repost Caption (if exists) */}
      {repost.caption && repost.caption.trim() && (
        <View style={styles.captionContainer}>
          <UserAvatar 
            profilePic={repost.user?.profile_pic}
            firstName={repost.user?.f_name}
            lastName={repost.user?.l_name}
            size={40}
            style={styles.avatar}
          />
          <View style={styles.captionContent}>
            <Text style={styles.captionUserName}>{repostUserName}</Text>
            <Text style={styles.caption}>{repost.caption}</Text>
          </View>
        </View>
      )}

      {/* Original Post (Embedded) */}
      <TouchableOpacity style={styles.originalPost} onPress={handleOriginalPostPress} activeOpacity={0.8}>
        <View style={styles.originalHeader}>
          <UserAvatar 
            profilePic={repost.original_post.user?.profile_pic}
            firstName={repost.original_post.user?.f_name}
            lastName={repost.original_post.user?.l_name}
            size={36}
            style={styles.originalAvatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.originalUserName}>{originalUserName}</Text>
            <Text style={styles.originalMeta}>{dayjs(repost.original_post.created_at).fromNow()}</Text>
          </View>
        </View>

        {/* Original Content */}
        {repost.original_post.post_title && <Text style={styles.originalTitle}>{repost.original_post.post_title}</Text>}
        <Text style={styles.originalContent}>{repost.original_post.post_content}</Text>
        {originalImageUrl && <Image source={{ uri: originalImageUrl }} style={styles.originalImage} resizeMode="cover" />}
      </TouchableOpacity>

      {/* Repost Stats */}
      <View style={styles.actionsCountsRow}>
        <TouchableOpacity onPress={() => onOpenViewer?.(repost, 'likes')}>
          <Text style={styles.countText}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${repost.repost_id}`)}>
          <Text style={styles.countText}>{repost.comments_count || 0} comments</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOpenViewer?.(repost, 'reposts')}>
          <Text style={styles.countText}>{repostCount} shares</Text>
        </TouchableOpacity>
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
          onPress={() => router.push(`/posts/comments?postId=${repost.repost_id}`)}
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
              <Text style={styles.modalButtonText}>Edit Caption</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton]}
              onPress={() => {
                setShowActions(false);
                handleDelete();
              }}
            >
              <Text style={[styles.modalButtonText, styles.deleteButtonText]}>Delete Repost</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Caption Modal */}
      <Modal visible={editModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Edit Caption</Text>
            <TextInput
              style={styles.editTextInput}
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="Add a caption..."
              multiline
              maxLength={500}
            />
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleEdit}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
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
    marginBottom: 16,
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
  repostText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 0,
    fontWeight: '500',
    flex: 1,
  },
  repostMeta: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  captionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  captionContent: {
    flex: 1,
  },
  captionUserName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
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
    height: 150,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  actionsCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  countText: {
    fontSize: 12,
    color: '#666',
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
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  editTextInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '45%',
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '45%',
  },
  cancelButtonText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
  },
  saveButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default RepostCard;

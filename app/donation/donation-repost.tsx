import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { API_BASE_URL, getDonationDetail, getUserInfo, repostDonationPost, likeDonationPost, unlikeDonationPost, commentOnDonationPost, getDonationComments } from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Ionicons } from '@expo/vector-icons';

dayjs.extend(relativeTime);

export default function DonationRepostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = typeof params.postId === 'string' ? parseInt(params.postId) : undefined;
  
  console.log('DonationRepostScreen - params:', params);
  console.log('DonationRepostScreen - postId:', postId);
  const [me, setMe] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caption, setCaption] = useState('');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'reposts' | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [myRepostId, setMyRepostId] = useState<number | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        console.log('DonationRepostScreen - useEffect running with postId:', postId);
        setLoading(true);
        const [u, detail] = await Promise.all([
          getUserInfo(),
          postId ? getDonationDetail(postId) : Promise.resolve(null),
        ]);
        console.log('DonationRepostScreen - getUserInfo result:', u);
        console.log('DonationRepostScreen - getDonationDetail result:', detail);
        setMe(u);
        setOriginal(detail);
      } catch (error) {
        console.error('DonationRepostScreen - Error loading data:', error);
        Alert.alert('Error', 'Failed to load post details');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [postId]);

  const handleRepost = async () => {
    if (!postId) {
      Alert.alert('Error', 'Invalid post ID');
      return;
    }

    try {
      setSubmitting(true);
      console.log('DonationRepostScreen - Creating repost with caption:', caption);
      const response = await repostDonationPost(postId, caption.trim() || undefined);
      console.log('DonationRepostScreen - Repost response:', response);
      
      if (response.success !== false) {
        Alert.alert('Success', 'Donation post reposted successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to repost');
      }
    } catch (error: any) {
      console.error('DonationRepostScreen - Error reposting:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to repost');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!original) return;
    
    try {
      if (original.is_liked) {
        await unlikeDonationPost(original.post_id);
        setOriginal((prev: any) => ({ 
          ...prev, 
          is_liked: false, 
          likes_count: Math.max(0, (prev.likes_count || 0) - 1) 
        }));
      } else {
        await likeDonationPost(original.post_id);
        setOriginal((prev: any) => ({ 
          ...prev, 
          is_liked: true, 
          likes_count: (prev.likes_count || 0) + 1 
        }));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = async () => {
    if (!original || !commentText.trim()) return;
    
    try {
      setSubmittingComment(true);
      await commentOnDonationPost(original.post_id, commentText.trim());
      setCommentText('');
      setCommentModalVisible(false);
      Alert.alert('Success', 'Comment added successfully!');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!original) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Repost Donation</Text>
        <TouchableOpacity 
          onPress={handleRepost} 
          disabled={submitting}
          style={[styles.repostButton, submitting && styles.disabledButton]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.repostButtonText}>Repost</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Original Post */}
        <View style={styles.originalPost}>
          <View style={styles.postHeader}>
            <Image
              source={{ uri: original.user?.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg' }}
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {original.user?.f_name} {original.user?.l_name}
              </Text>
              <Text style={styles.postDate}>
                {dayjs(original.created_at).fromNow()}
              </Text>
            </View>
          </View>

          <Text style={styles.postContent}>{original.post_content}</Text>
          
          {original.post_image && (
            <TouchableOpacity onPress={() => setImageViewerVisible(true)}>
              <Image source={{ uri: original.post_image }} style={styles.postImage} />
            </TouchableOpacity>
          )}

          <View style={styles.postStats}>
            <TouchableOpacity onPress={handleLike} style={styles.statButton}>
              <FontAwesome 
                name={original.is_liked ? 'heart' : 'heart-o'} 
                size={16} 
                color={original.is_liked ? '#e74c3c' : '#666'} 
              />
              <Text style={styles.statText}>{original.likes_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setCommentModalVisible(true)} 
              style={styles.statButton}
            >
              <FontAwesome name="comment-o" size={16} color="#666" />
              <Text style={styles.statText}>{original.comments_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Caption Input */}
        <View style={styles.captionSection}>
          <Text style={styles.captionLabel}>Add a caption (optional)</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="What are your thoughts?"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
          />
          <Text style={styles.characterCount}>{caption.length}/280</Text>
        </View>
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity 
            style={styles.imageViewerClose}
            onPress={() => setImageViewerVisible(false)}
          >
            <FontAwesome name="times" size={24} color="white" />
          </TouchableOpacity>
          <Image 
            source={{ uri: original.post_image }} 
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.commentModal}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>Add Comment</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <FontAwesome name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            
            <TouchableOpacity
              style={[styles.commentButton, submittingComment && styles.disabledButton]}
              onPress={handleComment}
              disabled={submittingComment || !commentText.trim()}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.commentButtonText}>Post Comment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  repostButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  repostButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  originalPost: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  postDate: {
    fontSize: 12,
    color: '#666',
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
  },
  captionSection: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 10,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  fullScreenImage: {
    width: '90%',
    height: '80%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  commentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  commentButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  commentButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

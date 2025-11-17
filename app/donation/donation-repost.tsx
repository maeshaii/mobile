import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { API_BASE_URL, getDonationDetail, getUserInfo, repostDonationPost, likeDonationPost, unlikeDonationPost, commentOnDonationPost, getDonationComments } from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Ionicons } from '@expo/vector-icons';
import { getImagesFromContent } from '../../utils/imageUtils';
import UserAvatar from '../../components/UserAvatar';

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
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.topBarButtonLeft} 
          onPress={() => router.back()}
          disabled={submitting}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Repost</Text>
        <TouchableOpacity 
          style={[styles.topBarButtonRight, submitting && styles.disabledButton]} 
          onPress={handleRepost} 
          disabled={submitting}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#222" />
          ) : (
            <Text style={styles.postButton}>Repost</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.separator} />

      {/* User Info Section */}
      <View style={styles.userSection}>
        <TouchableOpacity
          onPress={() => {
            const uid = me?.user_id || me?.id;
            if (uid) router.push(`/profile/profilepage?viewUserId=${uid}`);
          }}
          activeOpacity={0.7}
        >
          <UserAvatar 
            profilePic={me?.profile_pic}
            firstName={me?.f_name}
            lastName={me?.l_name}
            size={40}
            style={styles.userAvatar}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const uid = me?.user_id || me?.id;
            if (uid) router.push(`/profile/profilepage?viewUserId=${uid}`);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.userName}>{me?.f_name} {me?.l_name}</Text>
        </TouchableOpacity>
      </View>

        {/* Caption Input */}
        <View style={styles.captionSection}>
          <TextInput
            style={styles.captionInput}
          placeholder="Say something about this..."
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
          />
      </View>

      {/* Original Post */}
      <TouchableOpacity 
        style={styles.originalPostCard}
        onPress={() => {
          // Navigate to the original post detail page
          router.push(`/posts/detail?postId=${original.post_id || original.donation_id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.originalPostHeader}>
          <TouchableOpacity
            onPress={() => {
              const uid = original?.user?.user_id || original?.user?.id;
              if (uid) router.push(`/profile/profilepage?viewUserId=${uid}`);
            }}
            activeOpacity={0.7}
          >
            <UserAvatar 
              profilePic={original.user?.profile_pic}
              firstName={original.user?.f_name}
              lastName={original.user?.l_name}
              size={40}
              style={styles.originalAvatar}
            />
          </TouchableOpacity>
          <View style={styles.originalUserInfo}>
            <TouchableOpacity
              onPress={() => {
                const uid = original?.user?.user_id || original?.user?.id;
                if (uid) router.push(`/profile/profilepage?viewUserId=${uid}`);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.originalUserName}>
                {original.user?.f_name} {original.user?.l_name}
              </Text>
            </TouchableOpacity>
            <Text style={styles.originalPostLabel}>Original post</Text>
          </View>
        </View>

        <Text style={styles.originalPostContent}>{original.post_content}</Text>
        
        {/* Images - Facebook-style grid layout like dashboard */}
        {(() => {
          const images = getImagesFromContent(original);
          
          return images.length > 0 && (
            <View style={styles.imagesContainer}>
              {images.length === 1 ? (
                // Single image - full width
                <TouchableOpacity 
                  onPress={() => setImageViewerVisible(true)}
                >
                  <Image source={{ uri: images[0].image_url }} style={styles.singleImage} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                // Multiple images - Facebook-style grid layout (2x2 max 4 images)
                <View style={styles.imagesGrid}>
                  {images.slice(0, 4).map((image, index) => {
                    const imageUri = String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}`;
                    return (
                      <TouchableOpacity 
                        key={index}
                        style={styles.fourImagesGrid}
                        onPress={() => setImageViewerVisible(true)}
                      >
                        <Image 
                          source={{ uri: imageUri }} 
                          style={styles.gridImage} 
                          resizeMode="cover" 
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
          );
        })()}
      </TouchableOpacity>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // Top Bar Styles - matching post creation interface
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
    alignItems: 'center',
    paddingHorizontal: 10,
    minWidth: 44,
    zIndex: 10,
  },
  topBarButtonRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    minWidth: 44,
    zIndex: 10,
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
  // User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#1e3a8a',
  },
  // Caption Section
  captionSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  captionInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#D9D9D9',
  },
  // Original Post Card
  originalPostCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  originalPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  originalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  originalUserInfo: {
    flex: 1,
  },
  originalUserName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#1e3a8a',
  },
  originalPostLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  originalPostContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  // Image grid styles - matching dashboard layout
  imagesContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'space-between',
  },
  fourImagesGrid: {
    width: '49%',
    height: 150,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  // Loading and Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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

import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput } from 'react-native';
import { followUser, getUserInfo, checkFollowStatus, getForumPosts, getAlumniByBatch, getPostLikes, getPostReposts, commentOnPost, getPostComments } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import ForumPostCard from '../forum/ForumPostCard';
import RepostCard from '../repost/RepostCard';

const forumLogo = require('../../assets/images/wny_logo.jpg');

const orgInfo = {
  name: 'OJT Forum',
  profile_pic: forumLogo,
};

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_date: string;
  user: {
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  is_liked: boolean;
  is_reposted: boolean;
}

export default function OJTForumPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const loadForumPosts = async () => {
    try {
      setLoading(true);
      const response = await getForumPosts();
      if (response.success) {
        setPosts(response.posts || []);
      } else {
        Alert.alert('Error', response.error || 'Failed to load forum posts');
      }
    } catch (error) {
      console.error('Error loading forum posts:', error);
      Alert.alert('Error', 'Failed to load forum posts');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadForumPosts().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    loadForumPosts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadForumPosts();
    }, [])
  );

  const handleComment = async () => {
    if (!selectedPost || !commentText.trim()) return;
    
    setCommentLoading(true);
    try {
      const response = await commentOnPost(selectedPost.post_id, commentText.trim());
      if (response.success) {
        setCommentText('');
        setShowCommentModal(false);
        setSelectedPost(null);
        loadForumPosts(); // Refresh posts
      } else {
        Alert.alert('Error', response.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const renderPost = (item: PostItem, index: number) => {
    if (item.item_type === 'repost') {
      return (
        <RepostCard
          key={`repost-${item.repost_id}`}
          repost={item}
          currentUserId={user?.user_id || user?.id}
          formatTime={(date: string) => {
            const now = new Date();
            const postDate = new Date(date);
            const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);
            
            if (diffInSeconds < 60) return 'Just now';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
            return `${Math.floor(diffInSeconds / 86400)}d ago`;
          }}
          onRefresh={loadForumPosts}
        />
      );
    }

    return (
      <ForumPostCard
        key={`post-${item.post_id}`}
        post={item}
        currentUserId={user?.user_id || user?.id}
        formatTime={(date: string) => {
          const now = new Date();
          const postDate = new Date(date);
          const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);
          
          if (diffInSeconds < 60) return 'Just now';
          if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
          if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
          return `${Math.floor(diffInSeconds / 86400)}d ago`;
        }}
        onComment={() => {
          setSelectedPost(item);
          setShowCommentModal(true);
        }}
        onRefresh={loadForumPosts}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OJT Forum</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading forum posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No forum posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to start a discussion!</Text>
          </View>
        ) : (
          posts.map((item, index) => renderPost(item, index))
        )}
      </ScrollView>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity
                onPress={() => setShowCommentModal(false)}
                style={styles.closeButton}
              >
                <FontAwesome name="times" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.commentInput}
              placeholder="Write your comment..."
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setShowCommentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.submitButton, commentLoading && styles.disabledButton]}
                onPress={handleComment}
                disabled={commentLoading || !commentText.trim()}
              >
                <Text style={styles.submitButtonText}>
                  {commentLoading ? 'Posting...' : 'Post Comment'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
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
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
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
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  submitButton: {
    backgroundColor: '#007bff',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

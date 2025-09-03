import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { commentOnPost, getPostComments, getPostsByUserType, getUserInfo, likePost, unlikePost } from '../../services/api';

const pesoLogo = require('../../assets/images/peso_logo.jpg');

const orgInfo = {
  name: 'PESO',
  username: '@PESO_CTU_MAIN_CAMPUS',
  bio: 'Peso CTU-Main Campus',
  profile_pic: pesoLogo,
};

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

export default function PESOPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPosts();
    getUserInfo().then(setCurrentUser);
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const postsData = await getPostsByUserType('peso');
      console.log('Fetched PESO posts:', postsData);
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching PESO posts:', error);
      Alert.alert('Error', 'Failed to load PESO posts. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (post: Post) => {
    try {
      console.log('Handling like for post:', post.id, 'Current like status:', post.is_liked);
      if (post.is_liked) {
        await unlikePost(post.id);
        setPosts(prevPosts => prevPosts.map(p => 
          p.id === post.id 
            ? { ...p, is_liked: false, likes_count: Math.max(0, p.likes_count - 1) }
            : p
        ));
      } else {
        await likePost(post.id);
        setPosts(prevPosts => prevPosts.map(p => 
          p.id === post.id 
            ? { ...p, is_liked: true, likes_count: p.likes_count + 1 }
            : p
        ));
      }
    } catch (error) {
      console.error('Error liking/unliking post:', error);
      Alert.alert('Error', 'Failed to like/unlike post. Please try again.');
    }
  };

  const handleComment = async () => {
    if (!selectedPost || !commentText.trim()) return;

    try {
      setSubmittingComment(true);
      await commentOnPost(selectedPost.id, commentText);
      
      // Refresh comments for the selected post
      const comments = await getPostComments(selectedPost.id);
      setPosts(prevPosts => prevPosts.map(p => 
        p.id === selectedPost.id 
          ? { ...p, comments: comments, comments_count: comments.length }
          : p
      ));
      
      setCommentText('');
      setCommentModalVisible(false);
      setSelectedPost(null);
    } catch (error) {
      console.error('Error commenting:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      // Check if date is valid
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

  const openCommentModal = (post: Post) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Blue Header with Back Button and Message Button */}
      <View style={styles.headerContainer}>
      <View style={styles.headerBg} />
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => router.push('/messages/chatmessage?name=PESO')}
      >
        <FontAwesome name="envelope" size={20} color="#fff" />
      </TouchableOpacity>
    </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#174f84" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Org Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileImageWrapper}>
              <Image source={orgInfo.profile_pic} style={styles.profileImage} />
            </View>
            <Text style={styles.profileName}>{orgInfo.name}</Text>
            <Text style={styles.profileUsername}>{orgInfo.username}</Text>
            <View style={styles.bioRow}>
              <Text style={styles.bioText}>{orgInfo.bio}</Text>
            </View>
          </View>

          {/* Posts */}
          {posts.length === 0 ? (
            <View style={styles.noPostsContainer}>
              <Text style={styles.noPostsText}>No PESO posts yet</Text>
              <Text style={styles.noPostsSubtext}>
                Posts from PESO will appear here
              </Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
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
                {post.post_image && (
                  <Image 
                    source={{ 
                      uri: post.post_image.startsWith('http') 
                        ? post.post_image 
                        : `http://192.168.254.139:8000${post.post_image}`
                    }} 
                    style={styles.postImage} 
                  />
                )}
                <View style={styles.postActions}>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handleLike(post)}
                  >
                    <FontAwesome 
                      name={post.is_liked ? "heart" : "heart-o"} 
                      size={16} 
                      color={post.is_liked ? "#e74c3c" : "#888"} 
                    />
                    <Text style={[styles.actionText, post.is_liked && styles.likedText]}>
                      {post.likes_count} Like{post.likes_count !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => openCommentModal(post)}
                  >
                    <FontAwesome name="comment-o" size={16} color="#888" />
                    <Text style={styles.actionText}>
                      {post.comments_count} Comment{post.comments_count !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* Show recent comments */}
                {post.comments && post.comments.length > 0 && (
                  <View style={styles.commentsSection}>
                    {post.comments.slice(0, 2).map((comment) => (
                      <View key={comment.id} style={styles.commentItem}>
                        <Text style={styles.commentAuthor}>
                          {comment.user.first_name} {comment.user.last_name}:
                        </Text>
                        <Text style={styles.commentText}>{comment.comment_content}</Text>
                      </View>
                    ))}
                    {post.comments.length > 2 && (
                      <TouchableOpacity onPress={() => openCommentModal(post)}>
                        <Text style={styles.viewMoreComments}>
                          View all {post.comments.length} comments
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

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
            
            <ScrollView style={styles.commentsList}>
              {selectedPost?.comments?.map((comment) => (
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
            </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 0,
  },
  headerContainer: {
    position: 'relative',
    overflow: 'visible', 
    backgroundColor: '#fff', 
  },
  headerBg: {
    height: 200,
    backgroundColor: '#174f84',
    width: '100%',
    zIndex: 0,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 20,
  },
  messageButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#174f84',
  },
  noPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  noPostsText: {
    fontSize: 16,
    color: '#888',
  },
  noPostsSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 5,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 2,
    alignItems: 'center',
    marginTop: -80,
    position: 'relative',
    paddingTop: 60,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    width: '100%',
    zIndex: 2,
  },
  profileImageWrapper: {
    position: 'absolute',
    top: -70,
    left: '50%',
    marginLeft: -60,
    zIndex: 5,
    borderWidth: 6,
    borderColor: '#fff',
    borderRadius: 50,
    width: 120,
    height: 120,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 50,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#222',
    textAlign: 'center',
  },
  profileUsername: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    textAlign: 'center',
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#444',
    marginRight: 10,
  },
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

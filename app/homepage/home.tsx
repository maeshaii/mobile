import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import NavBar from '../(tabs)/navbar';
import { API_BASE_URL, commentOnPost, getPosts, getUserInfo, likePost, logoutUser, repostPost, unlikePost } from '../../services/api';

interface Post {
  post_id: number;
  post_title: string;
  post_content: string;
  post_image: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic: string;
  };
  likes: any[];
  comments: any[];
  reposts: any[];
  reposts_count: number;
  created_at: string;
  type: string;
}

interface UserInfo {
  name?: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
  course?: string;
  year_graduated?: number;
}

const HomeScreen = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({ name: '', course: '', year_graduated: '', profile_pic: '' });
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadUserInfo();
    loadPosts();
  }, []);

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      const userInfo = await getUserInfo();
      if (userInfo) {
        setUser(userInfo);
        setEditData({
          name: userInfo.name || '',
          course: userInfo.course || '',
          year_graduated: userInfo.year_graduated ? String(userInfo.year_graduated) : '',
          profile_pic: userInfo.profile_pic || '',
        });
      } else {
        router.replace('/login/login');
      }
    } catch (err) {
      setError('Failed to load user information');
      console.error('Error loading user info:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      setPostsLoading(true);
      const postsData = await getPosts();
      setPosts(postsData);
    } catch (error) {
      console.error('Error loading posts:', error);
      // Don't show error alert for posts, just log it
    } finally {
      setPostsLoading(false);
    }
  };

  const handleLikePost = async (postId: number, isLiked: boolean) => {
    try {
      if (isLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
      // Refresh posts to get updated like status
      await loadPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleRepost = async (postId: number) => {
    try {
      await repostPost(postId);
      Alert.alert('Success', 'Post reposted successfully!');
      // Refresh posts to get updated repost status
      await loadPosts();
    } catch (error) {
      console.error('Error reposting:', error);
      Alert.alert('Error', 'Failed to repost. You may have already reposted this.');
    }
  };

  const handleComment = async (postId: number) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  };

  const submitComment = async () => {
    if (!selectedPostId || !commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      await commentOnPost(selectedPostId, commentText.trim());
      setCommentText('');
      setCommentModalVisible(false);
      setSelectedPostId(null);
      Alert.alert('Success', 'Comment added successfully!');
      // Refresh posts to get updated comment count
      await loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
              router.replace('/login/login');
            } catch (err) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
              console.error('Logout error:', err);
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    setEditModalVisible(true);
  };

  const handleSaveProfile = () => {
    if (user) {
      setUser({ 
        ...user, 
        name: editData.name,
        course: editData.course,
        year_graduated: editData.year_graduated ? parseInt(editData.year_graduated) : undefined,
        profile_pic: editData.profile_pic
      });
    }
    setEditModalVisible(false);
    Alert.alert('Profile updated (not saved to backend)');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1d';
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadUserInfo}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar />
      {/* Header with logout button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
      </View>


      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* Start a Post */}
      <View style={styles.postCard}>
        <View style={styles.postRow}>
          <Image
              source={user?.profile_pic ? { uri: String(user.profile_pic).startsWith('http') || String(user.profile_pic).startsWith('data:') ? String(user.profile_pic) : `${API_BASE_URL}${user.profile_pic}` } : require('../../assets/images/sample_pic.jpg')}
            style={styles.avatar}
          />
            <TouchableOpacity
              style={styles.startPostInputWrapper}
              onPress={() => router.push('/posts/post')}
              activeOpacity={0.8}
            >
              <Text style={styles.startPostText}>Start a post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts Feed */}
        {postsLoading ? (
          <View style={styles.postsLoadingContainer}>
            <ActivityIndicator size="large" color="#1e3a8a" />
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.noPostsContainer}>
            <Text style={styles.noPostsText}>No posts yet. Be the first to share something!</Text>
      </View>
        ) : (
          posts.map((post) => {
            const userName = `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User';
            const userAvatar = post.user?.profile_pic 
              ? { uri: String(post.user.profile_pic).startsWith('http') || String(post.user.profile_pic).startsWith('data:') ? String(post.user.profile_pic) : `${API_BASE_URL}${post.user.profile_pic}` }
              : require('../../assets/images/sample_pic.jpg');
            const isLiked = typeof (post as any).is_liked === 'boolean' ? (post as any).is_liked : Array.isArray((post as any).likes) && (post as any).likes.length > 0;
            const likeCount = (post as any).likes_count ?? ((post as any).likes ? (post as any).likes.length : 0);
            const commentCount = (post as any).comments_count ?? ((post as any).comments ? (post as any).comments.length : 0);
            const repostCount = (post as any).reposts_count ?? ((post as any).reposts ? (post as any).reposts.length : 0);

            // Detect if current user reposted this post
            let reposterName: string | null = null;
            try {
              // get current user id
              // inline require to avoid circular import
              const current = user as any;
              const currentId = current?.id || current?.user_id;
              if (currentId && Array.isArray((post as any).reposts)) {
                const match = (post as any).reposts.find((r: any) => r?.user?.user_id === currentId);
                if (match) {
                  reposterName = `${match.user?.f_name || ''} ${match.user?.l_name || ''}`.trim();
                }
              }
            } catch {}

            return (
              <View key={post.post_id} style={styles.card}>
            <View style={styles.cardHeader}>
                  <Image source={userAvatar} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{userName}</Text>
                    <Text style={styles.meta}>
                      {formatDate(post.created_at)} • 🌐{reposterName ? `  •  Reposted by ${reposterName}` : ''}
                    </Text>
              </View>
            </View>

                {post.post_title && (
                  <Text style={styles.postTitle}>{post.post_title}</Text>
                )}

                <Text style={styles.content}>{post.post_content}</Text>

                {post.post_image && (
                  <Image 
                    source={{ uri: String(post.post_image).startsWith('http') || String(post.post_image).startsWith('data:') ? String(post.post_image) : `${API_BASE_URL}${post.post_image}` }} 
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                )}

            <View style={styles.actionsCountsRow}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/posts/likes', params: { postId: String(post.post_id) } })}>
                <Text style={styles.countText}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push({ pathname: '/posts/comments', params: { postId: String(post.post_id) } })}>
                <Text style={styles.countText}>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push({ pathname: '/posts/reposts', params: { postId: String(post.post_id) } })}>
                <Text style={styles.countText}>{repostCount} {repostCount === 1 ? 'share' : 'shares'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity 
                style={styles.actionIcon}
                onPress={() => handleLikePost(post.post_id, isLiked)}
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
                onPress={() => handleComment(post.post_id)}
              >
                <FontAwesome name="comment-o" size={18} color="#555" />
                <Text style={styles.actionText}>Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionIcon}
                onPress={() => handleRepost(post.post_id)}
              >
                <FontAwesome name="retweet" size={18} color="#555" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
            );
          })
        )}

        {/* Comment Modal */}
        <Modal visible={commentModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TextInput
                style={styles.modalInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write your comment..."
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#1e3a8a' }]}
                  onPress={submitComment}
                >
                  <Text style={{ color: '#fff' }}>Post Comment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#eee' }]}
                  onPress={() => {
                    setCommentModalVisible(false);
                    setCommentText('');
                    setSelectedPostId(null);
                  }}
                >
                  <Text style={{ color: '#1e3a8a' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scroll: {
    paddingHorizontal: 10,
  },
  scrollContent: {
    paddingBottom: 20,
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
    padding: 12,
    marginVertical: 10,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    width: '100%',
    alignSelf: 'center',
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startPostInputWrapper: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
    justifyContent: 'center',
  },
  startPostText: {
    color: '#777',
    fontSize: 15,
  },
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
  name: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
    color: '#666',
  },
  followBtn: {
    backgroundColor: '#E6F0FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  followText: {
    color: '#1C4E80',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    fontSize: 14,
    marginTop: 10,
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  actionIcon: {
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    fontSize: 12,
    color: '#555',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#174f84',
    fontSize: 14,
    fontWeight: '500',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  profileCourse: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  profileBatch: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  editProfileBtn: {
    marginLeft: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#E6F0FF',
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  saveBtn: {
    backgroundColor: '#174f84',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '45%',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '45%',
  },
  welcomeContainer: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 18,
    color: '#555',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 18,
    color: '#ff0000',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#174f84',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 20,
  },
  noPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 20,
  },
  noPostsText: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#ccc',
  },
  actionsCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  countText: {
    fontSize: 12,
    color: '#666',
  },
  likedText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});

import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import NavBar from '../(tabs)/_navbar';
import { API_BASE_URL, commentOnPost, getPosts, getUserInfo, likePost, logoutUser, repostPost, unlikePost } from '../../services/api';
import PostModal from './postmodal';

interface Post {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  created_at: string;
  type?: string;
  is_liked?: boolean;
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
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPostActionSheet, setShowPostActionSheet] = useState(false);
  const [postActionForId, setPostActionForId] = useState<number | null>(null);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    loadUserInfo();
    loadPosts();
  }, []);

  // Add refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPosts();
    } finally {
      setRefreshing(false);
    }
  };

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
      console.log('Homepage posts data:', postsData); // Debug log
      setPosts(Array.isArray(postsData) ? postsData : []);
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
      setPosts([]);
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


      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1e3a8a']}
            tintColor="#1e3a8a"
          />
        }
      >
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
            <Text style={styles.pullToRefreshText}>Pull down to refresh</Text>
          </View>
        ) : (
          posts.map((post) => {
            const userName = `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User';
            const userAvatar = post.user?.profile_pic 
              ? { uri: String(post.user.profile_pic).startsWith('http') || String(post.user.profile_pic).startsWith('data:') ? String(post.user.profile_pic) : `${API_BASE_URL}${post.user.profile_pic}` }
              : require('../../assets/images/sample_pic.jpg');
            const isLiked = post.is_liked || false;
            const likeCount = post.likes_count || 0;
            const commentCount = post.comments_count || 0;
            const repostCount = post.reposts_count || 0;

            // Detect if current user reposted this post
            let reposterName: string | null = null;
            try {
              // get current user id
              // inline require to avoid circular import
              const current = user as any;
              const currentId = current?.id || current?.user_id;
              if (currentId && Array.isArray(post.reposts)) {
                const match = post.reposts.find((r: any) => r?.user?.user_id === currentId);
                if (match) {
                  reposterName = `${match.user?.f_name || ''} ${match.user?.l_name || ''}`.trim();
                }
              }
            } catch {}

            // --- UPDATED IMAGE URL LOGIC ---
            const imageUrl = post.post_image
              ? (String(post.post_image).startsWith('http') || String(post.post_image).startsWith('data:')
                  ? String(post.post_image)
                  : `${API_BASE_URL}${post.post_image}`)
              : null;

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
              {(() => { try { const me:any = user; const meId = me?.id || me?.user_id; return meId && (post as any)?.user?.user_id === meId; } catch { return false; } })() ? (
                <TouchableOpacity
                  onPress={() => { setPostActionForId(post.post_id); setEditPostContent(post.post_content || ''); setShowPostActionSheet(true); }}
                  style={{ padding: 6 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome name="ellipsis-h" size={18} color="#888" />
                </TouchableOpacity>
              ) : null}
            </View>

                {post.post_title && (
                  <Text style={styles.postTitle}>{post.post_title}</Text>
                )}

                <Text style={styles.content}>{post.post_content}</Text>

                {imageUrl && (
                  <Image 
                    source={{ uri: imageUrl }} 
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                )}

            <View style={styles.actionsCountsRow}>
              <TouchableOpacity onPress={() => { setSelectedPost(post); setViewerType('likes'); setViewerVisible(true); }}>
                <Text style={styles.countText}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}>
                <Text style={styles.countText}>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSelectedPost(post); setViewerType('reposts'); setViewerVisible(true); }}>
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
                onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}
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

        {/* Viewer Modal */}
        <Modal
          visible={viewerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setViewerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.viewerModal}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.modalTitle}>
                  {viewerType === 'likes' ? 'Likes' : viewerType === 'comments' ? 'Comments' : 'Reposts'}
                </Text>
                <TouchableOpacity onPress={() => setViewerVisible(false)}>
                  <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                {viewerType === 'likes' && selectedPost?.likes?.map((u: any, idx: number) => (
                  <View key={idx} style={styles.listItemRow}>
                    <Image source={{ uri: u.profile_pic || 'https://randomuser.me/api/portraits/men/45.jpg' }} style={styles.listAvatar} />
                    <Text style={styles.listText}>{u.f_name} {u.l_name}</Text>
                  </View>
                ))}

                {viewerType === 'reposts' && selectedPost?.reposts?.map((r: any) => (
                  <View key={r.repost_id} style={styles.listItemRow}>
                    <Image source={{ uri: r.user?.profile_pic || 'https://randomuser.me/api/portraits/men/46.jpg' }} style={styles.listAvatar} />
                    <View>
                      <Text style={styles.listText}>{r.user?.f_name} {r.user?.l_name}</Text>
                      <Text style={styles.listSubText}>{new Date(r.repost_date).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}

                {viewerType === 'comments' && selectedPost?.comments?.map((c: any) => (
                  <View key={c.comment_id} style={styles.listItemRow}>
                    <Image source={{ uri: c.user?.profile_pic || 'https://randomuser.me/api/portraits/women/46.jpg' }} style={styles.listAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listText}>{c.user?.f_name} {c.user?.l_name}</Text>
                      <Text style={styles.commentBody}>{c.comment_content}</Text>
                      <Text style={styles.listSubText}>{new Date(c.date_created).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {viewerType === 'comments' && selectedPost ? (
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    value={commentText}
                    onChangeText={setCommentText}
                  />
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={async () => {
                      const message = (commentText || '').trim();
                      if (!message) return;
                      try {
                        await commentOnPost(selectedPost.post_id, message);
                        setCommentText('');
                        setViewerVisible(false);
                        await loadPosts(); // Refresh posts
                      } catch (e) {
                        Alert.alert('Error', 'Failed to add comment');
                      }
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Send</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      </ScrollView>
      {/* Post actions sheet */}
      <Modal visible={showPostActionSheet} transparent animationType="fade" onRequestClose={() => setShowPostActionSheet(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Select Action</Text>
              <TouchableOpacity onPress={() => setShowPostActionSheet(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.listItemRow}
              onPress={() => { setShowPostActionSheet(false); if (postActionForId != null) { setEditPostContent(posts.find(p=>p.post_id===postActionForId)?.post_content || ''); setEditingPostId(postActionForId); } }}
            >
              <Text style={styles.listText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.listItemRow}
              onPress={() => { setShowPostActionSheet(false); const id = postActionForId; if (id!=null) { Alert.alert('Delete Post','Are you sure you want to delete this post?',[{ text:'Cancel', style:'cancel' }, { text:'Delete', style:'destructive', onPress: async ()=>{ try { const { deletePost } = await import('../../services/api'); await deletePost(id); await loadPosts(); } catch { Alert.alert('Error','Failed to delete'); } } }]); } }}
            >
              <Text style={[styles.listText, { color: 'red' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Unified Post Modal for Edit/Delete */}
      {editingPostId != null && (
        <PostModal
          visible={true}
          postId={editingPostId}
          initialContent={editPostContent}
          onClose={() => setEditingPostId(null)}
          onSaved={async () => { await loadPosts(); }}
          onDeleted={async () => { await loadPosts(); }}
        />
      )}
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
  pullToRefreshText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
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
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxHeight: '80%',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ef',
    marginRight: 10,
  },
  listText: {
    fontSize: 14,
    color: '#1e3a8a',
    fontWeight: '600',
  },
  listSubText: {
    fontSize: 12,
    color: '#888',
  },
  commentBody: {
    fontSize: 14,
    color: '#333',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  sendBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
});

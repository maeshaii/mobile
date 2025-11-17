import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getPosts, getUserInfo, getPostLikes, getPostReposts, getRepostLikes, getRepostDetail, getAdminPesoUsers, getAlumniDetails } from '../../services/api';
import PostCard from '../posts/postCard';
import UserAvatar from '../../components/UserAvatar';
import { formatUserFullName } from '../../utils/nameUtils';

const ccictLogo = require('../../assets/images/ccict_logo.jpg');

interface Post {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  post_images?: any[];
  type?: string | null;
  created_at?: string | null;
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  user: { 
    user_id: number; 
    f_name: string; 
    l_name: string; 
    profile_pic?: string | null;
    account_type?: string;
    user_type?: string;
  };
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

export default function CCICTPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any>(null);

  useEffect(() => {
    fetchPosts();
    loadUserInfo();
    loadAdminProfile();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userInfo = await getUserInfo();
      setUser(userInfo);
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadAdminProfile = async () => {
    try {
      console.log('CCICT page - Loading admin profile...');
      
      // Get admin user IDs
      const adminUsersData = await getAdminPesoUsers();
      const adminUserIds = adminUsersData.admin_user_ids || [];
      console.log('CCICT page - Admin user IDs:', adminUserIds);
      
      if (adminUserIds.length > 0) {
        // Get the first admin user's profile
        const adminUserId = adminUserIds[0];
        console.log('CCICT page - Getting profile for admin user ID:', adminUserId);
        
        const adminDetails = await getAlumniDetails(adminUserId);
        console.log('CCICT page - Admin details:', adminDetails);
        
        // Create admin profile object using actual user data
        const adminProfileData = {
          name: formatUserFullName(adminDetails) || adminDetails?.acc_username || 'CCICT Admin',
          username: adminDetails?.acc_username || '@CCICT_CTU_MAIN_CAMPUS',
          bio: adminDetails?.profile_bio || '', // Use actual profile_bio, empty string if not set
          profile_pic: adminDetails?.profile_pic 
            ? (String(adminDetails.profile_pic).startsWith('http') || String(adminDetails.profile_pic).startsWith('data:'))
              ? adminDetails.profile_pic 
              : `https://magnitudinous-labialized-lorelei.ngrok-free.dev${adminDetails.profile_pic}`
            : ccictLogo,
        };
        
        console.log('CCICT page - Admin profile data:', adminProfileData);
        setAdminProfile(adminProfileData);
      } else {
        // Fallback to default CCICT info if no admin found
        console.log('CCICT page - No admin users found, using default');
        setAdminProfile({
          name: 'CCICT',
          username: '@CCICT_CTU_MAIN_CAMPUS',
          bio: '', // No hardcoded bio, use empty string
          profile_pic: ccictLogo,
        });
      }
    } catch (error) {
      console.error('CCICT page - Error loading admin profile:', error);
      // Fallback to default CCICT info on error
      setAdminProfile({
        name: 'CCICT',
        username: '@CCICT_CTU_MAIN_CAMPUS',
        bio: '', // No hardcoded bio, use empty string
        profile_pic: ccictLogo,
      });
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      console.log('CCICT page - Fetching posts (simplified approach)...');
      
      // Get all posts (same as main feed) - admin posts are already included
      const allPostsData = await getPosts();
      console.log('CCICT page - Received all posts data:', allPostsData);
      console.log('CCICT page - Total posts:', allPostsData?.length || 0);
      
      // Get current user ID for like persistence
      const currentUser = await getUserInfo();
      const currentUserId = currentUser?.user_id || currentUser?.id;
      
      // Filter for admin posts by checking user account type or name patterns
      const adminPosts = allPostsData.filter((post: any) => {
        const user = post.user || {};
        const userName = formatUserFullName(user).toLowerCase();
        const isAdminPost = 
          user.account_type === 'admin' ||
          user.user_type === 'admin' ||
          userName.includes('admin') ||
          userName.includes('ccict') ||
          user.f_name?.toLowerCase().includes('admin') ||
          user.l_name?.toLowerCase().includes('admin');
        
        console.log(`CCICT page - Post ${post.id || post.post_id}:`);
        console.log(`  - User name: ${formatUserFullName(user)}`);
        console.log(`  - User account_type: ${user.account_type}`);
        console.log(`  - User user_type: ${user.user_type}`);
        console.log(`  - Is admin post: ${isAdminPost}`);
        
        return isAdminPost;
      }).map((post: any) => {
        // Set is_liked based on current user's likes
        const likesArr = Array.isArray(post?.likes) ? post.likes : [];
        const likedByMe = currentUserId ? likesArr.some((l: any) => l?.user_id === currentUserId || l?.user?.user_id === currentUserId) : false;
        
        return {
          ...post,
          is_liked: !!likedByMe
        };
      });
      
      console.log('CCICT page - Filtered admin posts:', adminPosts);
      console.log('CCICT page - Number of admin posts:', adminPosts?.length || 0);
      
      if (adminPosts && Array.isArray(adminPosts)) {
        setPosts(adminPosts);
        console.log('CCICT page - Successfully set admin posts:', adminPosts.length);
      } else {
        console.log('CCICT page - No admin posts found');
        setPosts([]);
      }
    } catch (error: any) {
      console.error('CCICT page - Error fetching posts:', error);
      console.error('CCICT page - Error details:', error.response?.data || error.message);
      console.error('CCICT page - Error status:', error.response?.status);
      console.error('CCICT page - Error URL:', error.config?.url);
      Alert.alert('Error', `Failed to load CCICT posts: ${error.message || 'Unknown error'}`);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLikeToggle = (postId: number, isLiked: boolean) => {
    setPosts(prev =>
      prev.map(p =>
        p.post_id === postId
          ? {
              ...p,
              is_liked: isLiked,
              likes_count: isLiked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1),
            }
          : p
      )
    );
  };

  const handleCommentAdded = (postId: number, comments: Comment[]) => {
    setPosts(prev =>
      prev.map(p =>
        p.post_id === postId ? { ...p, comments, comments_count: comments.length } : p
      )
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    await loadAdminProfile();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#1e3a8a']}
          tintColor="#1e3a8a"
        />
      }
    >
      {/* Blue Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => router.push('/messages/chatmessage?name=CCICT')}
        >
          <FontAwesome name="envelope" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Org Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image 
            source={adminProfile?.profile_pic || ccictLogo} 
            style={styles.profileImage} 
          />
        </View>
        <Text style={styles.profileName}>{adminProfile?.name || 'CCICT'}</Text>
        <Text style={styles.profileUsername}>{adminProfile?.username || '@CCICT_CTU_MAIN_CAMPUS'}</Text>
        {adminProfile?.bio && adminProfile.bio.trim() ? (
          <View style={styles.bioRow}>
            <Text style={styles.bioText}>{adminProfile.bio}</Text>
          </View>
        ) : null}
      </View>

      {/* Posts */}
      <View style={styles.postsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#174f84" />
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.noPostsContainer}>
            <Text style={styles.noPostsText}>This user has not posted anything yet.</Text>
          </View>
        ) : (
          posts.map(post => (
          <PostCard
            key={post.post_id}
            post={post}
            currentUserId={user?.user_id}
            onLikeToggle={handleLikeToggle}
            onOpenViewer={async (post, type) => {
              try {
                setSelectedPostStats(post);
                setViewerType(type);
                setViewerVisible(true);

                if (type === 'likes') {
                  const likesData = await getPostLikes(post.post_id);
                  setSelectedPostStats((prev: any) => ({ ...prev, likes: likesData || [] }));
                } else if (type === 'reposts') {
                  const repostsData = await getPostReposts(post.post_id);
                  setSelectedPostStats((prev: any) => ({ ...prev, reposts: repostsData || [] }));
                }
              } catch (error) {
                console.error('Error fetching viewer data:', error);
                Alert.alert('Error', 'Failed to load data');
              }
            }}
            onEdited={(postId, newContent) => {
              setPosts(prev => prev.map(p => 
                p.post_id === postId 
                  ? { ...p, post_content: newContent } 
                  : p
              ));
            }}
            onDeleted={(postId) => {
              setPosts(prev => prev.filter(p => p.post_id !== postId));
            }}
            onRepostToggle={(postId, reposted) => {
              setPosts(prev => prev.map(p => 
                p.post_id === postId 
                  ? { ...p, reposts_count: Math.max(0, (p.reposts_count || 0) + (reposted ? 1 : -1)) } 
                  : p
              ));
            }}
          />
          ))
        )}
      </View>

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
              {viewerType === 'likes' && selectedPostStats?.likes?.length > 0 && selectedPostStats?.likes?.map((u: any, idx: number) => (
                <View key={idx} style={styles.listItemRow}>
                  <UserAvatar 
                    profilePic={u.profile_pic}
                    firstName={u.f_name}
                    lastName={u.l_name}
                    size={32}
                    style={styles.listAvatar}
                  />
                  <Text style={styles.listText}>{formatUserFullName(u)}</Text>
                </View>
              ))}

              {viewerType === 'likes' && (!selectedPostStats?.likes || selectedPostStats?.likes?.length === 0) && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#666', fontSize: 16 }}>No likes yet</Text>
                </View>
              )}

              {viewerType === 'reposts' && selectedPostStats?.reposts?.length > 0 && selectedPostStats?.reposts?.map((r: any) => (
                <View key={r.repost_id} style={styles.listItemRow}>
                  <UserAvatar 
                    profilePic={r.user?.profile_pic}
                    firstName={r.user?.f_name}
                    lastName={r.user?.l_name}
                    size={32}
                    style={styles.listAvatar}
                  />
                  <View>
                    <Text style={styles.listText}>{formatUserFullName(r.user)}</Text>
                    <Text style={styles.listSubText}>{new Date(r.repost_date).toLocaleString()}</Text>
                  </View>
                </View>
              ))}

              {viewerType === 'reposts' && (!selectedPostStats?.reposts || selectedPostStats?.reposts?.length === 0) && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#666', fontSize: 16 }}>No reposts yet</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  postsContainer: {
    paddingHorizontal: 10,
  },
  headerContainer: {
    position: 'relative',
  },
  headerBg: {
    height: 160,
    backgroundColor: '#174f84',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
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
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 2,
    alignItems: 'center',
    marginTop: -30,
    paddingTop: 60,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    width: '100%',
  },
  profileImageWrapper: {
    position: 'absolute',
    top: -40,
    left: '50%',
    marginLeft: -50,
    zIndex: 2,
    borderWidth: 4,
    borderColor: '#fff',
    borderRadius: 50,
    width: 100,
    height: 100,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  profileImage: {
    width: 90,
    height: 90,
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 50,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
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
});

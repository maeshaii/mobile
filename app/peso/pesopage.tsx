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

const pesoLogo = require('../../assets/images/peso_logo.jpg');

const orgInfo = {
  name: 'PESO',
  username: '@PESO_CTU_MAIN_CAMPUS',
  bio: 'Peso CTU-Main Campus',
  profile_pic: pesoLogo,
};

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

export default function PESOPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [pesoProfile, setPesoProfile] = useState<any>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any>(null);

  useEffect(() => {
    fetchPosts();
    loadUserInfo();
    loadPesoProfile();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userInfo = await getUserInfo();
      setUser(userInfo);
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadPesoProfile = async () => {
    try {
      console.log('PESO page - Loading peso profile...');
      
      // Get peso user IDs
      const pesoUsersData = await getAdminPesoUsers();
      const pesoUserIds = pesoUsersData.peso_user_ids || [];
      console.log('PESO page - Peso user IDs:', pesoUserIds);
      
      if (pesoUserIds.length > 0) {
        // Get the first peso user's profile
        const pesoUserId = pesoUserIds[0];
        console.log('PESO page - Getting profile for peso user ID:', pesoUserId);
        
        const pesoDetails = await getAlumniDetails(pesoUserId);
        console.log('PESO page - Peso details:', pesoDetails);
        
        // Create peso profile object using actual user data
        const pesoProfileData = {
          name: pesoDetails?.f_name && pesoDetails?.l_name 
            ? `${pesoDetails.f_name} ${pesoDetails.l_name}` 
            : pesoDetails?.acc_username || 'PESO',
          username: pesoDetails?.acc_username || '@PESO_CTU_MAIN_CAMPUS',
          bio: pesoDetails?.profile_bio || pesoDetails?.bio || 'Public Employment Service Office',
          profile_pic: pesoDetails?.profile_pic 
            ? (String(pesoDetails.profile_pic).startsWith('http') || String(pesoDetails.profile_pic).startsWith('data:'))
              ? pesoDetails.profile_pic 
              : `https://magnitudinous-labialized-lorelei.ngrok-free.dev${pesoDetails.profile_pic}`
            : pesoLogo,
        };
        
        console.log('PESO page - Peso profile data:', pesoProfileData);
        setPesoProfile(pesoProfileData);
      } else {
        // Fallback to default PESO info if no peso found
        console.log('PESO page - No peso users found, using default');
        setPesoProfile({
          name: 'PESO',
          username: '@PESO_CTU_MAIN_CAMPUS',
          bio: 'Public Employment Service Office',
          profile_pic: pesoLogo,
        });
      }
    } catch (error) {
      console.error('PESO page - Error loading peso profile:', error);
      // Fallback to default PESO info on error
      setPesoProfile({
        name: 'PESO',
        username: '@PESO_CTU_MAIN_CAMPUS',
        bio: 'Public Employment Service Office',
        profile_pic: pesoLogo,
      });
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      console.log('PESO page - Fetching posts (simplified approach)...');
      
      // Get all posts (same as main feed) - peso posts are already included
      const allPostsData = await getPosts();
      console.log('PESO page - Received all posts data:', allPostsData);
      console.log('PESO page - Total posts:', allPostsData?.length || 0);
      
      // Get current user ID for like persistence
      const currentUser = await getUserInfo();
      const currentUserId = currentUser?.user_id || currentUser?.id;
      
      // Filter for peso posts by checking user account type or name patterns
      const pesoPosts = allPostsData.filter((post: any) => {
        const user = post.user || {};
        const userName = `${user.f_name || ''} ${user.l_name || ''}`.toLowerCase();
        const isPesoPost = 
          user.account_type === 'peso' ||
          user.user_type === 'peso' ||
          userName.includes('peso') ||
          user.f_name?.toLowerCase().includes('peso') ||
          user.l_name?.toLowerCase().includes('peso') ||
          post.type === 'peso';
        
        console.log(`PESO page - Post ${post.id || post.post_id}:`);
        console.log(`  - User name: ${user.f_name} ${user.l_name}`);
        console.log(`  - User account_type: ${user.account_type}`);
        console.log(`  - User user_type: ${user.user_type}`);
        console.log(`  - Post type: ${post.type}`);
        console.log(`  - Is peso post: ${isPesoPost}`);
        
        return isPesoPost;
      }).map((post: any) => {
        // Set is_liked based on current user's likes
        const likesArr = Array.isArray(post?.likes) ? post.likes : [];
        const likedByMe = currentUserId ? likesArr.some((l: any) => l?.user_id === currentUserId || l?.user?.user_id === currentUserId) : false;
        
        return {
          ...post,
          is_liked: !!likedByMe
        };
      });
      
      console.log('PESO page - Filtered peso posts:', pesoPosts);
      console.log('PESO page - Number of peso posts:', pesoPosts?.length || 0);
      
      if (pesoPosts && Array.isArray(pesoPosts)) {
        setPosts(pesoPosts);
        console.log('PESO page - Successfully set peso posts:', pesoPosts.length);
      } else {
        console.log('PESO page - No peso posts found');
        setPosts([]);
      }
    } catch (error: any) {
      console.error('PESO page - Error fetching posts:', error);
      console.error('PESO page - Error details:', error.response?.data || error.message);
      console.error('PESO page - Error status:', error.response?.status);
      console.error('PESO page - Error URL:', error.config?.url);
      Alert.alert('Error', `Failed to load PESO posts: ${error.message || 'Unknown error'}`);
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
    await loadPesoProfile();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} tintColor="#1e3a8a" />
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
          onPress={() => router.push('/messages/chatmessage?name=PESO')}
        >
          <FontAwesome name="envelope" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Org Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image 
            source={pesoProfile?.profile_pic || pesoLogo} 
            style={styles.profileImage} 
          />
        </View>
        <Text style={styles.profileName}>{pesoProfile?.name || 'PESO'}</Text>
        <Text style={styles.profileUsername}>{pesoProfile?.username || '@PESO_CTU_MAIN_CAMPUS'}</Text>
        <View style={styles.bioRow}>
          <Text style={styles.bioText}>{pesoProfile?.bio || 'Public Employment Service Office'}</Text>
        </View>
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
            <Text style={styles.noPostsText}>No PESO posts yet</Text>
            <Text style={styles.noPostsSubtext}>
              Posts from PESO admin users will appear here
            </Text>
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
                  <Text style={styles.listText}>{u.f_name} {u.l_name}</Text>
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
                    <Text style={styles.listText}>{r.user?.f_name} {r.user?.l_name}</Text>
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
  noPostsSubtext: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
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

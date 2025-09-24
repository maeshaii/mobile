import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore
import * as ImagePicker from 'expo-image-picker';
import {
  API_BASE_URL,
  checkFollowStatus,
  fetchFollowers,
  fetchFollowing,
  followUser,
  getAlumniDetails,
  getPosts,
  getUserInfo,
  likePost,
  unlikePost,
  repostPost,
  unfollowUser,
  updateAlumniProfile,
  getPostDetail,
} from '../../services/api';
import FollowModal from '../follow/follow';
import UserAvatar from '../../components/UserAvatar';
import PostCard from '../posts/postCard';
import RepostCard from '../posts/RepostCard';

const profilePic = require('../../assets/images/sample_pic.jpg');

interface UserProfile {
  name: string;
  username: string;
  bio: string;
  profile_pic: any;
  followers_count?: number;
  following_count?: number;
  f_name?: string;
  l_name?: string;
}

interface Post {
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
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  created_at: string;
  item_type: 'post';
}

interface FeedRepost {
  repost_id: number;
  created_at: string;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id?: number;
  };
  caption?: string;
  original_post: Post;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  item_type: 'repost';
}

type FeedItem = Post | FeedRepost;

// Type guards
const isRepost = (item: FeedItem): item is FeedRepost => {
  return item.item_type === 'repost';
};

const isPost = (item: FeedItem): item is Post => {
  return item.item_type === 'post';
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBio, setEditBio] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams();
  const viewUserId = typeof params.viewUserId === 'string' ? parseInt(params.viewUserId) : undefined;

  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [editMode, setEditMode] = useState<'bio' | 'photo'>('bio');
  const [showEditTabs, setShowEditTabs] = useState<boolean>(false);
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentProfilePicUri, setCurrentProfilePicUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  // viewer (likes/reposts)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      try {
        const me = await getUserInfo();
        const viewingOwn = !viewUserId || (me && (me.id === viewUserId || me.user_id === viewUserId));
        setIsOwnProfile(!!viewingOwn);

        if (viewingOwn) {
          const postsData = await getPosts();
          const profile: UserProfile = {
            name: me?.name || `${me?.f_name || ''} ${me?.l_name || ''}`.trim(),
            username: me?.acc_username || '@user',
            bio: me?.profile_bio || 'Bio',
            profile_pic: me?.profile_pic ? { uri: (String(me.profile_pic).startsWith('http') || String(me.profile_pic).startsWith('data:')) ? me.profile_pic : `${API_BASE_URL}${me.profile_pic}` } : null,
            followers_count: me?.followers_count || 0,
            following_count: me?.following_count || 0,
            f_name: me?.f_name || '',
            l_name: me?.l_name || '',
          };
          setUser(profile);
          setEditBio(profile.bio);
          setCurrentProfilePicUri(me?.profile_pic ? ((String(me.profile_pic).startsWith('http') || String(me.profile_pic).startsWith('data:')) ? me.profile_pic : `${API_BASE_URL}${me.profile_pic}`) : null);
          const userId = me?.id || me?.user_id;
          setProfileUserId(userId || null);
          
          // Create feed items that include both posts and reposts
          const feedItems: FeedItem[] = [];
          const userPosts = (postsData || []).filter((p: any) => p.user?.user_id === userId);
          
          userPosts.forEach((post: any) => {
            const likesArr = Array.isArray(post?.likes) ? post.likes : [];
            const likedByMe = userId ? likesArr.some((l: any) => l?.user_id === userId || l?.user?.user_id === userId) : false;
            
            // Add the original post
            feedItems.push({
              ...post,
              created_at: post.created_at || new Date().toISOString(),
              is_liked: !!likedByMe,
              item_type: 'post'
            });
            
            // Add each repost as a separate feed item
            if (Array.isArray(post.reposts)) {
              post.reposts.forEach((repost: any) => {
                feedItems.push({
                  repost_id: repost.repost_id,
                  created_at: repost.repost_date || new Date().toISOString(),
                  user: repost.user,
                  caption: repost.caption,
                  original_post: {
                    post_id: post.post_id,
                    post_title: post.post_title,
                    post_content: post.post_content,
                    post_image: post.post_image,
                    user: post.user,
                    created_at: post.created_at || new Date().toISOString(),
                    likes_count: post.likes_count,
                    comments_count: post.comments_count,
                    reposts_count: post.reposts_count,
                    is_liked: !!likedByMe,
                    item_type: 'post'
                  },
                  likes_count: 0, // TODO: Get repost likes from API
                  comments_count: 0, // TODO: Get repost comments from API
                  reposts_count: 0, // TODO: Get repost reposts from API
                  is_liked: false, // TODO: Check if user liked this repost
                  item_type: 'repost'
                });
              });
            }
          });
          
          // Sort by creation date (newest first)
          feedItems.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          });
          
          setPosts(feedItems);
          const [followersRes, followingRes] = await Promise.all([
            fetchFollowers(userId),
            fetchFollowing(userId)
          ]);
          console.log('Followers response:', followersRes);
          console.log('Following response:', followingRes);
          setFollowers(followersRes?.followers || []);
          setFollowing(followingRes?.following || []);
        } else {
          if (!viewUserId) return;
          const details = await getAlumniDetails(viewUserId);
          const a = details?.alumni || {};
          console.log('Alumni details response:', details);
          console.log('Alumni data:', a);
          const profile: UserProfile = {
            name: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'User',
            username: a.ctu_id ? `@${a.ctu_id}` : '@user',
            bio: a.profile_bio || '',
            profile_pic: a.profile_pic ? { uri: String(a.profile_pic).startsWith('http') ? a.profile_pic : `${API_BASE_URL}${a.profile_pic}` } : null,
            f_name: a.first_name || '',
            l_name: a.last_name || '',
          };
          setUser(profile);
          const [postsData, followersRes, followingRes, statusRes] = await Promise.all([
            getPosts(),
            fetchFollowers(viewUserId),
            fetchFollowing(viewUserId),
            checkFollowStatus(viewUserId),
          ]);
          console.log('Other user followers response:', followersRes);
          console.log('Other user following response:', followingRes);
          setFollowers(followersRes?.followers || []);
          setFollowing(followingRes?.following || []);
          setIsFollowing(!!statusRes?.is_following);
          setProfileUserId(viewUserId);
          
          // Create feed items that include both posts and reposts for other user
          const feedItems: FeedItem[] = [];
          const userPosts = (postsData || []).filter((p: any) => p.user?.user_id === viewUserId);
          
          userPosts.forEach((post: any) => {
            const likesArr = Array.isArray(post?.likes) ? post.likes : [];
            const likedByMe = viewUserId ? likesArr.some((l: any) => l?.user_id === viewUserId || l?.user?.user_id === viewUserId) : false;
            
            // Add the original post
            feedItems.push({
              ...post,
              created_at: post.created_at || new Date().toISOString(),
              is_liked: !!likedByMe,
              item_type: 'post'
            });
            
            // Add each repost as a separate feed item
            if (Array.isArray(post.reposts)) {
              post.reposts.forEach((repost: any) => {
                feedItems.push({
                  repost_id: repost.repost_id,
                  created_at: repost.repost_date || new Date().toISOString(),
                  user: repost.user,
                  caption: repost.caption,
                  original_post: {
                    post_id: post.post_id,
                    post_title: post.post_title,
                    post_content: post.post_content,
                    post_image: post.post_image,
                    user: post.user,
                    created_at: post.created_at || new Date().toISOString(),
                    likes_count: post.likes_count,
                    comments_count: post.comments_count,
                    reposts_count: post.reposts_count,
                    is_liked: !!likedByMe,
                    item_type: 'post'
                  },
                  likes_count: 0, // TODO: Get repost likes from API
                  comments_count: 0, // TODO: Get repost comments from API
                  reposts_count: 0, // TODO: Get repost reposts from API
                  is_liked: false, // TODO: Check if user liked this repost
                  item_type: 'repost'
                });
              });
            }
          });
          
          // Sort by creation date (newest first)
          feedItems.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          });
          
          setPosts(feedItems);
        }
      } catch (e) {
        setUser({
          name: 'User',
          username: '@user',
          bio: 'Bio',
          profile_pic: profilePic,
        });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [viewUserId]);

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  const reloadPosts = async () => {
    try {
      if (!profileUserId) return;
      const postsData = await getPosts();
      
      // Create feed items that include both posts and reposts
      const feedItems: FeedItem[] = [];
      const userPosts = (postsData || []).filter((p: any) => p.user?.user_id === profileUserId);
      
      userPosts.forEach((post: any) => {
        const likesArr = Array.isArray(post?.likes) ? post.likes : [];
        const likedByMe = profileUserId ? likesArr.some((l: any) => l?.user_id === profileUserId || l?.user?.user_id === profileUserId) : false;
        
        // Add the original post
        feedItems.push({
          ...post,
          is_liked: !!likedByMe,
          item_type: 'post'
        });
        
        // Add each repost as a separate feed item
        if (Array.isArray(post.reposts)) {
          post.reposts.forEach((repost: any) => {
            feedItems.push({
              repost_id: repost.repost_id,
              created_at: repost.repost_date,
              user: repost.user,
              caption: repost.caption,
              original_post: {
                post_id: post.post_id,
                post_title: post.post_title,
                post_content: post.post_content,
                post_image: post.post_image,
                user: post.user,
                created_at: post.created_at,
                likes_count: post.likes_count,
                comments_count: post.comments_count,
                reposts_count: post.reposts_count,
                is_liked: !!likedByMe,
                item_type: 'post'
              },
              likes_count: 0, // TODO: Get repost likes from API
              comments_count: 0, // TODO: Get repost comments from API
              reposts_count: 0, // TODO: Get repost reposts from API
              is_liked: false, // TODO: Check if user liked this repost
              item_type: 'repost'
            });
          });
        }
      });
      
      // Sort by creation date (newest first)
      feedItems.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
      
      setPosts(feedItems);
    } catch (e) {
      // keep last posts
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadPosts();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#1e3a8a"]}
          tintColor="#1e3a8a"
        />
      }
    >
      {/* Blue Header with Back Button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        {isOwnProfile && (
          <TouchableOpacity style={styles.editBtnAbsolute} onPress={() => { setEditMode('bio'); setShowEditTabs(false); setEditModalVisible(true); }}>
            <FontAwesome name="pencil" size={16} color="#174f84" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}

        <View style={styles.profileImageWrapper}>
          <UserAvatar
            profilePic={user.profile_pic?.uri}
            firstName={user.f_name}
            lastName={user.l_name}
            size={100}
            style={styles.profileImage}
          />

          {isOwnProfile && (
            <TouchableOpacity
              style={styles.profilePhotoEditBtn}
              onPress={() => { setEditMode('photo'); setShowEditTabs(false); setEditModalVisible(true); }}
              accessibilityLabel="Change profile picture"
            >
              <FontAwesome name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.profileName}>{user.name}</Text>
        <Text style={styles.profileUsername}>{user.username}</Text>

        {user.bio && (
          <Text style={styles.bioText}>{user.bio}</Text>
        )}

        {!isOwnProfile && (
          <View style={styles.profileActionsRow}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing ? styles.followingBtn : null]}
              onPress={async () => {
                try {
                  if (!viewUserId) return;
                  if (isFollowing) {
                    const res = await unfollowUser(viewUserId);
                    if (res?.success) {
                      setIsFollowing(false);
                      // Update follower count - decrease by 1
                      setFollowers(prev => prev.length > 0 ? prev.slice(0, -1) : []);
                    }
                  } else {
                    const res = await followUser(viewUserId);
                    if (res?.success) {
                      setIsFollowing(true);
                      // Update follower count - increase by 1
                      // We'll add a placeholder follower entry since we don't have the current user's full data
                      const currentUser = await getUserInfo();
                      if (currentUser) {
                        const newFollower = {
                          user_id: currentUser.id || currentUser.user_id,
                          ctu_id: currentUser.acc_username || 'current_user',
                          name: currentUser.name || `${currentUser.f_name || ''} ${currentUser.l_name || ''}`.trim(),
                          profile_pic: currentUser.profile_pic,
                          followed_at: new Date().toISOString()
                        };
                        setFollowers(prev => [...prev, newFollower]);
                      }
                    }
                  }
                } catch (e) { /* ignore */ }
              }}
            >
              <Text style={{ color: isFollowing ? '#174f84' : '#fff', fontWeight: 'bold' }}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => {
                const encodedName = encodeURIComponent(user.name);
                router.push(`/messages/chatmessage?name=${encodedName}`);
              }}
            >
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => {
              console.log('Opening followers modal with userId:', profileUserId);
              console.log('Followers array length:', followers.length);
              console.log('User followers_count:', user.followers_count);
              setShowFollowers(true);
            }}
          >
            <Text style={styles.statNumber}>{followers.length || user.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => {
              console.log('Opening following modal with userId:', profileUserId);
              console.log('Following array length:', following.length);
              console.log('User following_count:', user.following_count);
              setShowFollowing(true);
            }}
          >
            <Text style={styles.statNumber}>{following.length || user.following_count || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Start a Post (own profile only) */}
      {isOwnProfile && (
        <View style={styles.startPostCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <UserAvatar
              profilePic={user.profile_pic?.uri}
              firstName={user.f_name}
              lastName={user.l_name}
              size={40}
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.startPostInput} onPress={() => router.push('/posts/post')}>
              <Text style={{ color: '#888' }}>Start a post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Posts */}
      <View style={styles.postsSection}>
        <Text style={styles.postsHeader}>Posts</Text>
        {posts.length === 0 ? (
          <View style={styles.noPostsContainer}>
            <Text style={styles.noPostsText}>No posts yet.</Text>
          </View>
        ) : (
          posts.map((item) => {
            if (isRepost(item)) {
              return (
                <RepostCard
                  key={`repost-${item.repost_id}`}
                  repost={item}
                  currentUserId={profileUserId || undefined}
                  onLikeToggle={(repostId, liked) => {
                    setPosts(prev => prev.map(p => 
                      isRepost(p) && p.repost_id === repostId 
                        ? { ...p, is_liked: liked, likes_count: liked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1) } 
                        : p
                    ));
                  }}
                  onOpenViewer={(repost, type) => {
                    setSelectedPostStats(repost);
                    setViewerType(type);
                    setViewerVisible(true);
                  }}
                  onEdited={(repostId, newCaption) => {
                    setPosts(prev => prev.map(p => 
                      isRepost(p) && p.repost_id === repostId 
                        ? { ...p, caption: newCaption } 
                        : p
                    ));
                  }}
                  onDeleted={(repostId) => {
                    setPosts(prev => prev.filter(p => !(isRepost(p) && p.repost_id === repostId)));
                  }}
                />
              );
            } else {
              return (
                <PostCard
                  key={`post-${item.post_id}`}
                  post={item}
                  currentUserId={profileUserId || undefined}
                  onLikeToggle={(postId, isLiked) => {
                    setPosts(prev => prev.map(p => 
                      isPost(p) && p.post_id === postId 
                        ? { ...p, is_liked: isLiked, likes_count: isLiked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1) } 
                        : p
                    ));
                  }}
                  onOpenViewer={(post, type) => {
                    setSelectedPostStats(post);
                    setViewerType(type);
                    setViewerVisible(true);
                  }}
                  onEdited={(postId, newContent) => {
                    setPosts(prev => prev.map(p => 
                      isPost(p) && p.post_id === postId 
                        ? { ...p, post_content: newContent } 
                        : p
                    ));
                  }}
                  onDeleted={(postId) => {
                    setPosts(prev => prev.filter(p => !(isPost(p) && p.post_id === postId)));
                  }}
                />
              );
            }
          })
        )}
      </View>


      {/* Edit profile modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {showEditTabs && (
              <View style={styles.editTabs}>
                <TouchableOpacity style={[styles.editTabBtn, editMode === 'bio' && styles.editTabBtnActive]} onPress={() => setEditMode('bio')}>
                  <Text style={[styles.editTabText, editMode === 'bio' && styles.editTabTextActive]}>Edit Bio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editTabBtn, editMode === 'photo' && styles.editTabBtnActive]} onPress={() => setEditMode('photo')}>
                  <Text style={[styles.editTabText, editMode === 'photo' && styles.editTabTextActive]}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {editMode === 'bio' ? (
              <>
                <Text style={styles.modalTitle}>Edit Bio</Text>
                <TextInput style={styles.modalInput} value={editBio} onChangeText={setEditBio} placeholder="Enter your bio" />
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Update Profile Picture</Text>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#174f84', width: '100%', alignItems: 'center' }]}
                  onPress={async () => {
                    try {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: true,
                        aspect: [1, 1],
                        quality: 0.8,
                      });
                      if (!result.canceled && result.assets && result.assets.length > 0) {
                        setNewPhotoUri(result.assets[0].uri);
                      }
                    } catch (e) {
                      Alert.alert('Error', 'Failed to pick image');
                    }
                  }}
                >
                  <Text style={{ color: '#fff' }}>Choose Photo</Text>
                </TouchableOpacity>
                {newPhotoUri && <Image source={{ uri: newPhotoUri }} style={{ width: 140, height: 140, borderRadius: 70, marginTop: 12 }} />}
              </>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#174f84' }]}
                onPress={async () => {
                  try {
                    setSaving(true);
                    if (editMode === 'bio') {
                      await updateAlumniProfile({ bio: editBio });
                      setUser((prev) => prev ? { ...prev, bio: editBio } : prev);
                      Alert.alert('Profile updated!');
                    } else {
                      if (!newPhotoUri) {
                        Alert.alert('Select Photo', 'Please choose a photo to upload');
                        setSaving(false);
                        return;
                      }
                      await updateAlumniProfile({ bio: editBio, imageUri: newPhotoUri });
                      setUser((prev) => prev ? { ...prev, profile_pic: { uri: newPhotoUri } } : prev);
                      setCurrentProfilePicUri(newPhotoUri);
                      setNewPhotoUri(null);
                      Alert.alert('Profile picture updated!');
                    }
                    setEditModalVisible(false);
                  } catch (error) {
                    Alert.alert('Error', 'Failed to update profile');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                <Text style={{ color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#eee' }]} onPress={() => { setEditModalVisible(false); setNewPhotoUri(null); }} disabled={saving}>
                <Text style={{ color: '#174f84' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Viewer (likes/reposts) */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModalLarge}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>{viewerType === 'likes' ? 'Likes' : 'Reposts'}</Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
              {viewerType === 'likes' && selectedPostStats?.likes?.map((u: any, idx: number) => (
                <View key={idx} style={styles.listItemRow}>
                  <Image source={{ uri: u.profile_pic || 'https://randomuser.me/api/portraits/men/45.jpg' }} style={styles.avatar} />
                  <Text style={styles.listText}>{u.f_name} {u.l_name}</Text>
                </View>
              ))}

              {viewerType === 'reposts' && selectedPostStats?.reposts?.map((r: any) => (
                <View key={r.repost_id} style={styles.listItemRow}>
                  <Image source={{ uri: r.user?.profile_pic || 'https://randomuser.me/api/portraits/men/46.jpg' }} style={styles.avatar} />
                  <View>
                    <Text style={styles.listText}>{r.user?.f_name} {r.user?.l_name}</Text>
                    <Text style={styles.postMeta}>{new Date(r.repost_date).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Followers Modal */}
      <FollowModal
        visible={showFollowers}
        onClose={() => setShowFollowers(false)}
        type="followers"
        userId={profileUserId || 0}
      />

      {/* Following Modal */}
      <FollowModal
        visible={showFollowing}
        onClose={() => setShowFollowing(false)}
        type="following"
        userId={profileUserId || 0}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 0,
  },
  headerContainer: {
    position: 'relative',
    backgroundColor: '#174f84',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#174f84',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: -30,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    width: '100%',
  },
  profileImageWrapper: {
    position: 'absolute',
    top: -50,
    left: '50%',
    marginLeft: -50,
    zIndex: 2,
    borderWidth: 4,
    borderColor: '#fff',
    borderRadius: 50,
    width: 100,
    height: 100,
    overflow: 'visible',
    backgroundColor: '#eee',
  },
  profilePhotoEditBtn: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#174f84',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  profileImage: {
    width: 100,
    height: 100,
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
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    gap: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postsSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  postsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f0ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  editBtnText: {
    color: '#174f84',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  profileActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startPostCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  startPostInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
  },
  followBtn: {
    backgroundColor: '#e3ecf7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#174f84',
  },
  followingBtn: {
    backgroundColor: '#174f84',
    borderColor: '#174f84',
  },
  messageBtn: {
    backgroundColor: '#174f84',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBtnText: {
    color: '#fff',
    fontWeight: 'bold',
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
  postContent: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  countText: {
    fontSize: 12,
    color: '#666',
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

  /* Modals and lists */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerModalSmall: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 420,
  },
  viewerModalLarge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxWidth: 720,
    maxHeight: '80%',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listText: {
    fontSize: 16,
    color: '#222',
  },

  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  editTabs: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 12,
  },
  editTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  editTabBtnActive: {
    backgroundColor: '#e6f0ff',
    borderColor: '#174f84',
  },
  editTabText: {
    color: '#333',
    fontWeight: '500',
  },
  editTabTextActive: {
    color: '#174f84',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#174f84',
  },
  modalInput: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 15,
    color: '#333',
  },
  modalBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 0,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 50,
    flex: 1,
    textAlign: 'center',
  },

  editBtnAbsolute: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f0ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 2,
  },

  noPostsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noPostsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
});

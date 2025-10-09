import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore
import * as ImagePicker from 'expo-image-picker';
import {
  API_BASE_URL,
  checkFollowStatus,
  fetchFollowers,
  fetchFollowing,
  followUser,
  getAlumniDetails,
  getAlumniProfile,
  getUserProfileSocialMedia,
  getUserProfileEmail,
  getPosts,
  getUserPosts,
  getAllUserPosts,
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
import RepostCard from '../repost/RepostCard';

const profilePic = require('../../assets/images/sample_pic.jpg');

interface UserProfile {
  name: string;
  username: string;
  bio: string;
  profile_pic: any;
  socialMedia?: string;
  email?: string;
  followers_count?: number;
  following_count?: number;
  f_name?: string;
  l_name?: string;
}

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
  item_type?: 'post';
  user: { 
    user_id: number; 
    f_name: string; 
    l_name: string; 
    profile_pic?: string | null 
  };
}

interface OriginalPost {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  user: {
    f_name: string;
    l_name: string;
    profile_pic?: string;
    user_id: number;
  };
  likes?: any[];
  comments?: any[];
  reposts?: any[];
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  created_at: string;
  is_liked?: boolean;
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
  original_post: OriginalPost;
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
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [editSocialMedia, setEditSocialMedia] = useState('');
  const [editEmail, setEditEmail] = useState('');
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

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getUserInfo();
      const viewingOwn = !viewUserId || (me && (me.id === viewUserId || me.user_id === viewUserId));
      setIsOwnProfile(!!viewingOwn);

      if (viewingOwn) {
        const postsData = await getAllUserPosts(me.id || me.user_id);
        // Get full profile data including email and social_media
        const [profileData, socialMediaData, emailData] = await Promise.all([
          getAlumniProfile(me.id || me.user_id),
          getUserProfileSocialMedia(me.id || me.user_id),
          getUserProfileEmail(me.id || me.user_id)
        ]);
        
        console.log('Profile API Response:', profileData);
        console.log('Social Media API Response:', socialMediaData);
        console.log('Email API Response:', emailData);
        
        const profile: UserProfile = {
          name: me?.name || `${me?.f_name || ''} ${me?.l_name || ''}`.trim(),
          username: me?.acc_username || '@user',
          bio: profileData?.profile_bio || me?.profile_bio || 'Bio',
          socialMedia: socialMediaData?.social_media || '',
          email: emailData?.email || '',
          profile_pic: me?.profile_pic ? { uri: (String(me.profile_pic).startsWith('http') || String(me.profile_pic).startsWith('data:')) ? me.profile_pic : `${API_BASE_URL}${me.profile_pic}` } : null,
          followers_count: me?.followers_count || 0,
          following_count: me?.following_count || 0,
          f_name: me?.f_name || '',
          l_name: me?.l_name || '',
        };
        
        console.log('Final Profile Object:', profile);
        console.log('Profile Social Media:', profile.socialMedia);
        console.log('Profile Email:', profile.email);
        setUser(profile);
        setEditBio(profile.bio);
        setEditSocialMedia(profile.socialMedia || '');
        setEditEmail(profile.email || '');
        setCurrentProfilePicUri(me?.profile_pic ? ((String(me.profile_pic).startsWith('http') || String(me.profile_pic).startsWith('data:')) ? me.profile_pic : `${API_BASE_URL}${me.profile_pic}`) : null);
        const userId = me?.id || me?.user_id;
        setProfileUserId(userId || null);
          
          // Create feed items that include both posts and reposts
          const feedItems: FeedItem[] = [];
          const userPostsData = postsData?.posts || postsData || [];
          
          userPostsData.forEach((item: any) => {
            if (item.item_type === 'post') {
              // Handle original posts
              const likesArr = Array.isArray(item?.likes) ? item.likes : [];
              const likedByMe = userId ? likesArr.some((l: any) => l?.user_id === userId || l?.user?.user_id === userId) : false;
              
              feedItems.push({
                ...item,
                created_at: item.created_at || new Date().toISOString(),
                is_liked: !!likedByMe,
                item_type: 'post'
              });
            } else if (item.item_type === 'repost') {
              // Handle reposts
              const repostLikesArr = Array.isArray(item?.likes) ? item.likes : [];
              const repostLikedByMe = userId ? repostLikesArr.some((l: any) => l?.user_id === userId || l?.user?.user_id === userId) : false;
              
              feedItems.push({
                ...item,
                created_at: item.repost_date || new Date().toISOString(),
                is_liked: !!repostLikedByMe,
                item_type: 'repost'
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
            socialMedia: a.social_media || '',
            email: a.email || '',
            profile_pic: a.profile_pic ? { uri: String(a.profile_pic).startsWith('http') ? a.profile_pic : `${API_BASE_URL}${a.profile_pic}` } : null,
            f_name: a.first_name || '',
            l_name: a.last_name || '',
          };
          setUser(profile);
          const [postsData, followersRes, followingRes, statusRes] = await Promise.all([
            getAllUserPosts(viewUserId),
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
          const userPostsData = postsData?.posts || postsData || [];
          
          userPostsData.forEach((item: any) => {
            if (item.item_type === 'post') {
              // Handle original posts
              const likesArr = Array.isArray(item?.likes) ? item.likes : [];
              const likedByMe = viewUserId ? likesArr.some((l: any) => l?.user_id === viewUserId || l?.user?.user_id === viewUserId) : false;
              
              feedItems.push({
                ...item,
                created_at: item.created_at || new Date().toISOString(),
                is_liked: !!likedByMe,
                item_type: 'post'
              });
            } else if (item.item_type === 'repost') {
              // Handle reposts
              const repostLikesArr = Array.isArray(item?.likes) ? item.likes : [];
              const repostLikedByMe = viewUserId ? repostLikesArr.some((l: any) => l?.user_id === viewUserId || l?.user?.user_id === viewUserId) : false;
              
              feedItems.push({
                ...item,
                created_at: item.repost_date || new Date().toISOString(),
                is_liked: !!repostLikedByMe,
                item_type: 'repost'
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
    }, [viewUserId]);

  useEffect(() => {
    loadUser();
  }, [viewUserId, loadUser]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Profile page focused, reloading data...');
      loadUser();
    }, [loadUser])
  );

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
      const postsData = await getAllUserPosts(profileUserId);
      
      // Create feed items that include both posts and reposts
      const feedItems: FeedItem[] = [];
      const userPostsData = postsData?.posts || postsData || [];
      
      userPostsData.forEach((item: any) => {
        if (item.item_type === 'post') {
          // Handle original posts
          const likesArr = Array.isArray(item?.likes) ? item.likes : [];
          const likedByMe = profileUserId ? likesArr.some((l: any) => l?.user_id === profileUserId || l?.user?.user_id === profileUserId) : false;
          
          feedItems.push({
            ...item,
            is_liked: !!likedByMe,
            item_type: 'post'
          });
        } else if (item.item_type === 'repost') {
          // Handle reposts
          const repostLikesArr = Array.isArray(item?.likes) ? item.likes : [];
          const repostLikedByMe = profileUserId ? repostLikesArr.some((l: any) => l?.user_id === profileUserId || l?.user?.user_id === profileUserId) : false;
          
          feedItems.push({
            ...item,
            created_at: item.repost_date || new Date().toISOString(),
            is_liked: !!repostLikedByMe,
            item_type: 'repost'
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
      {/* Blue Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
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
          <View style={styles.bioRow}>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        )}

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.followButton, isFollowing && styles.followingButton]}
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
              <Text style={[styles.actionButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.messageButton]}
              onPress={() => {
                const encodedName = encodeURIComponent(user.name);
                router.push(`/messages/chatmessage?name=${encodedName}`);
              }}
            >
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
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
            <Text style={styles.statLabel}>Followings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Details Card */}
      <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Details</Text>
          
          {user.socialMedia && (
            <View style={styles.detailRow}>
              <FontAwesome name="globe" size={16} color="#666" style={styles.detailIcon} />
              <Text style={styles.detailText}>{user.socialMedia}</Text>
            </View>
          )}
          
          {user.email && (
            <View style={styles.detailRow}>
              <FontAwesome name="envelope" size={16} color="#666" style={styles.detailIcon} />
              <Text style={styles.detailText}>{user.email}</Text>
            </View>
          )}
          
          {isOwnProfile && (
            <TouchableOpacity style={styles.editDetailsBtn} onPress={() => setShowEditDetailsModal(true)}>
              <FontAwesome name="pencil" size={14} color="#fff" style={styles.editDetailsIcon} />
              <Text style={styles.editDetailsText}>Edit public details</Text>
            </TouchableOpacity>
          )}
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
                  key={`profile-repost-${item.repost_id}`}
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
                  onOriginalPostReposted={(originalPostId) => {
                    // Update the original post's repost count when it's reposted from a RepostCard
                    setPosts(prev => prev.map(p => {
                      if (isPost(p) && p.post_id === originalPostId) {
                        return {
                          ...p,
                          reposts_count: (p.reposts_count || 0) + 1
                        };
                      }
                      return p;
                    }));
                  }}
                />
              );
            } else {
              return (
                <PostCard
                  key={`profile-post-${item.post_id}`}
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
                    console.log('Profile: Opening viewer for type:', type);
                    console.log('Profile: Post data:', post);
                    console.log('Profile: Likes data:', post.likes);
                    console.log('Profile: Likes count:', post.likes?.length);
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
                  onRepostToggle={(postId, isReposted) => {
                    // Update repost count when a repost is created/deleted
                    setPosts(prev => prev.map(p => {
                      if (isPost(p) && p.post_id === postId) {
                        return {
                          ...p,
                          reposts_count: Math.max(0, (p.reposts_count || 0) + (isReposted ? 1 : -1))
                        };
                      }
                      return p;
                    }));
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
      <Modal visible={viewerVisible} transparent animationType="slide" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>{viewerType === 'likes' ? 'Likes' : viewerType === 'comments' ? 'Comments' : 'Reposts'}</Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {/* Debug info */}
              {viewerType === 'likes' && (
                <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 5, borderRadius: 5 }}>
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    Debug: Likes count: {selectedPostStats?.likes?.length || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    Debug: Likes data: {JSON.stringify(selectedPostStats?.likes?.slice(0, 2) || [])}
                  </Text>
                </View>
              )}
              
              {viewerType === 'likes' && selectedPostStats?.likes?.length > 0 && selectedPostStats?.likes?.map((u: any, idx: number) => {
                console.log('Profile: Rendering like user:', u);
                return (
                  <View key={idx} style={styles.listItemRow}>
                    <UserAvatar 
                      profilePic={u.profile_pic}
                      firstName={u.f_name}
                      lastName={u.l_name}
                      size={36}
                      style={styles.listAvatar}
                    />
                    <Text style={styles.listText}>{u.f_name} {u.l_name}</Text>
                  </View>
                );
              })}
              
              {viewerType === 'likes' && (!selectedPostStats?.likes || selectedPostStats?.likes?.length === 0) && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#666', fontSize: 16 }}>No likes yet</Text>
                </View>
              )}

              {viewerType === 'reposts' && selectedPostStats?.reposts?.map((r: any) => (
                <View key={r.repost_id} style={styles.listItemRow}>
                  <UserAvatar 
                    profilePic={r.user?.profile_pic}
                    firstName={r.user?.f_name}
                    lastName={r.user?.l_name}
                    size={36}
                    style={styles.listAvatar}
                  />
                  <View>
                    <Text style={styles.listText}>{r.user?.f_name} {r.user?.l_name}</Text>
                    <Text style={styles.listSubText}>{new Date(r.repost_date).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Followers Modal */}
      {profileUserId && (
        <FollowModal
          visible={showFollowers}
          onClose={() => setShowFollowers(false)}
          type="followers"
          userId={profileUserId}
        />
      )}

      {/* Following Modal */}
      {profileUserId && (
        <FollowModal
          visible={showFollowing}
          onClose={() => setShowFollowing(false)}
          type="following"
          userId={profileUserId}
        />
      )}

      {/* Edit Details Modal */}
      <Modal
        visible={showEditDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditDetailsModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit public details</Text>
              <TouchableOpacity onPress={() => setShowEditDetailsModal(false)}>
                <FontAwesome name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.modalInput, styles.bioInput]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Enter your bio"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Social Media Link</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSocialMedia}
                  onChangeText={setEditSocialMedia}
                  placeholder="e.g., facebook.com/yourpage"
                  keyboardType="url"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="your.email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowEditDetailsModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={async () => {
                  try {
                    setSaving(true);
                    await updateAlumniProfile({
                      bio: editBio,
                      socialMedia: editSocialMedia,
                      email: editEmail
                    });
                    setUser((prev) => prev ? {
                      ...prev,
                      bio: editBio,
                      socialMedia: editSocialMedia,
                      email: editEmail
                    } : prev);
                    setShowEditDetailsModal(false);
                    Alert.alert('Profile updated!');
                  } catch (error) {
                    console.error('Error updating profile:', error);
                    Alert.alert('Error', 'Failed to update profile');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  },
  headerBg: {
    height: 160,
    backgroundColor: '#174f84',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    width: '100%',
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
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 10,
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
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    width: '100%',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    marginRight: 12,
    width: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  editDetailsBtn: {
    backgroundColor: '#174f84',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  editDetailsIcon: {
    marginRight: 6,
  },
  editDetailsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#174f84',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#e3ecf7',
  },
  followingButton: {
    backgroundColor: '#174f84',
  },
  messageButton: {
    backgroundColor: '#174f84',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#174f84',
  },
  followingButtonText: {
    color: '#fff',
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
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
  viewerModalSmall: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 420,
  },
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxHeight: '70%',
    minHeight: 200,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
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
  bioInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 10,
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
    top: 40,
    left: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
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

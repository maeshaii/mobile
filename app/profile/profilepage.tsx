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

const profilePic = require('../../assets/images/sample_pic.jpg');

interface UserProfile {
  name: string;
  username: string;
  bio: string;
  profile_pic: any;
}

function getInitials(name: string) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBio, setEditBio] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams();
  const viewUserId = typeof params.viewUserId === 'string' ? parseInt(params.viewUserId) : undefined;

  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [editMode, setEditMode] = useState<'bio' | 'photo'>('bio');
  const [showEditTabs, setShowEditTabs] = useState<boolean>(false);
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentProfilePicUri, setCurrentProfilePicUri] = useState<string | null>(null);
  const [actionLoadingPostId, setActionLoadingPostId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  // action sheet & edit-post modal
  const [postActionForId, setPostActionForId] = useState<number | null>(null);
  const [showPostActionSheet, setShowPostActionSheet] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState<string>('');

  // viewer (likes/reposts)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'reposts' | null>(null);
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
            profile_pic: me?.profile_pic ? { uri: (String(me.profile_pic).startsWith('http') || String(me.profile_pic).startsWith('data:')) ? me.profile_pic : `${API_BASE_URL}${me.profile_pic}` } : profilePic,
          };
          setUser(profile);
          setEditBio(profile.bio);
          setCurrentProfilePicUri(me?.profile_pic ? ((String(me.profile_pic).startsWith('http') || String(me.profile_pic).startsWith('data:')) ? me.profile_pic : `${API_BASE_URL}${me.profile_pic}`) : null);
          const userId = me?.id || me?.user_id;
          setProfileUserId(userId || null);
          const userPosts = (postsData || []).filter((p: any) => p.user?.user_id === userId);
          setPosts(userPosts);
          const followersRes = await fetchFollowers(userId);
          setFollowers(followersRes?.followers || []);
        } else {
          if (!viewUserId) return;
          const details = await getAlumniDetails(viewUserId);
          const a = details?.alumni || {};
          const profile: UserProfile = {
            name: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim(),
            username: a.ctu_id ? `@${a.ctu_id}` : '@user',
            bio: a.profile_bio || '',
            profile_pic: a.profile_pic ? { uri: String(a.profile_pic).startsWith('http') ? a.profile_pic : `${API_BASE_URL}${a.profile_pic}` } : profilePic,
          };
          setUser(profile);
          const [postsData, followersRes, statusRes] = await Promise.all([
            getPosts(),
            fetchFollowers(viewUserId),
            checkFollowStatus(viewUserId),
          ]);
          setFollowers(followersRes?.followers || []);
          setIsFollowing(!!statusRes?.is_following);
          setProfileUserId(viewUserId);
          const userPosts = (postsData || []).filter((p: any) => p.user?.user_id === viewUserId);
          setPosts(userPosts);
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
      const userPosts = (postsData || []).filter((p: any) => p.user?.user_id === profileUserId);
      setPosts(userPosts);
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
          {user.profile_pic && user.profile_pic.uri ? (
            <Image source={user.profile_pic} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, { backgroundColor: '#bcd0e6', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 36, color: '#174f84', fontWeight: 'bold' }}>{getInitials(user.name)}</Text>
            </View>
          )}

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

        {!isOwnProfile && (
          <View style={styles.profileActionsRow}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing ? styles.followingBtn : null]}
              onPress={async () => {
                try {
                  if (!viewUserId) return;
                  if (isFollowing) {
                    const res = await unfollowUser(viewUserId);
                    if (res?.success) setIsFollowing(false);
                  } else {
                    const res = await followUser(viewUserId);
                    if (res?.success) setIsFollowing(true);
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

        <View style={styles.bioRow}>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>
      </View>

      {/* Start a Post (own profile only) */}
      {isOwnProfile && (
        <View style={styles.startPostCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={user.profile_pic} style={styles.avatar} />
            <TouchableOpacity style={styles.startPostInput} onPress={() => router.push('/posts/post')}>
              <Text style={{ color: '#888' }}>Start a post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <View style={styles.noPostsContainer}>
          <Text style={styles.noPostsText}>No posts yet. Start sharing your thoughts!</Text>
        </View>
      ) : (
        posts.map((post: any) => (
          <View key={post.post_id} style={styles.postCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              {post.user?.profile_pic ? (
                <Image
                  source={{ uri: (post.user.profile_pic && (String(post.user.profile_pic).startsWith('http') || String(post.user.profile_pic).startsWith('data:'))) ? post.user.profile_pic : `${API_BASE_URL}${post.user.profile_pic}` }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#bcd0e6', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 16, color: '#174f84', fontWeight: 'bold' }}>{getInitials(`${post.user?.f_name || ''} ${post.user?.l_name || ''}`)}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.postName}>{post.user?.f_name} {post.user?.l_name}</Text>
                <Text style={styles.postMeta}>
                  {(() => {
                    try {
                      const d = new Date(post.created_at);
                      const now = new Date();
                      const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
                      if (diff < 1) return 'Just now';
                      if (diff < 60) return `${diff}m`;
                      const h = Math.floor(diff / 60);
                      if (h < 24) return `${h}h`;
                      const dys = Math.floor(h / 24);
                      if (dys < 7) return `${dys}d`;
                      const w = Math.floor(dys / 7);
                      if (w < 5) return `${w}w`;
                      const mo = Math.floor(dys / 30);
                      if (mo < 12) return `${mo}mo`;
                      return `${Math.floor(dys / 365)}y`;
                    } catch {
                      return '';
                    }
                  })()}  •  <FontAwesome name="globe" size={12} color="#888" />
                </Text>
              </View>

              {profileUserId != null && (post.user?.user_id === profileUserId || (post.user as any)?.id === profileUserId) ? (
                <TouchableOpacity
                  onPress={() => {
                    setPostActionForId(post.post_id);
                    setEditPostContent(post.post_content || '');
                    setShowPostActionSheet(true);
                  }}
                  style={{ padding: 6 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome name="ellipsis-h" size={18} color="#888" />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.postContent}>{post.post_content}</Text>

            {post.post_image && (
              <Image source={{ uri: (String(post.post_image).startsWith('http') || String(post.post_image).startsWith('data:')) ? String(post.post_image) : `${API_BASE_URL}${post.post_image}` }} style={styles.postImage} />
            )}


            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={async () => {
                  try {
                    setActionLoadingPostId(post.post_id);
                    if (post.is_liked) {
                      await unlikePost(post.post_id);
                      setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, is_liked: false, likes_count: Math.max(0, (p.likes_count || 0) - 1) } : p));
                    } else {
                      await likePost(post.post_id);
                      setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 } : p));
                    }
                  } catch (e) {
                    Alert.alert('Error', 'Failed to update like');
                  } finally {
                    setActionLoadingPostId(null);
                  }
                }}
                disabled={actionLoadingPostId === post.post_id}
              >
                <FontAwesome name={post.is_liked ? 'thumbs-up' : 'thumbs-o-up'} size={16} color={post.is_liked ? '#1e3a8a' : '#888'} />
                <Text style={[styles.actionText, post.is_liked && { color: '#1e3a8a', fontWeight: '700' }]}>{post.likes_count || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}>
                <FontAwesome name="comment-o" size={16} color="#888" />
                <Text style={styles.actionText}>{post.comments_count || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={async () => {
                  try {
                    setActionLoadingPostId(post.post_id);
                    await repostPost(post.post_id);
                    setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, reposts_count: (p.reposts_count || 0) + 1 } : p));
                    Alert.alert('Reposted');
                  } catch (e) {
                    Alert.alert('Error', 'Failed to repost');
                  } finally {
                    setActionLoadingPostId(null);
                  }
                }}
                disabled={actionLoadingPostId === post.post_id}
              >
                <FontAwesome name="retweet" size={16} color="#888" />
                <Text style={styles.actionText}>{post.reposts_count || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Post actions sheet */}
      <Modal visible={showPostActionSheet} transparent animationType="fade" onRequestClose={() => setShowPostActionSheet(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModalSmall}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Select Action</Text>
              <TouchableOpacity onPress={() => setShowPostActionSheet(false)}>
                <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.listItemRow}
              onPress={() => { setShowPostActionSheet(false); if (postActionForId != null) { setEditPostContent(posts.find((p:any)=>p.post_id===postActionForId)?.post_content || ''); setEditingPostId(postActionForId); } }}
            >
              <Text style={styles.listText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.listItemRow}
              onPress={() => {
                setShowPostActionSheet(false);
                const id = postActionForId;
                if (id != null) {
                  Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                          const { deletePost } = await import('../../services/api');
                          await deletePost(id);
                          await reloadPosts();
                        } catch {
                          Alert.alert('Error', 'Failed to delete');
                        }
                      }
                    }
                  ]);
                }
              }}
            >
              <Text style={[styles.listText, { color: 'red' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    borderRadius: 8,
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
    color: '#888',
    marginBottom: 8,
    textAlign: 'center',
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#444',
    marginRight: 10,
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
    gap: 10,
    marginTop: 12,
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
    backgroundColor: '#174f84',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followingBtn: {
    backgroundColor: '#e6f0ff',
  },
  messageBtn: {
    backgroundColor: '#1C4E80',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
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

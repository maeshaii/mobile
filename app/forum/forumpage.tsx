import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, followUser, getUserInfo, checkFollowStatus, getForumPosts, likeForumPost, unlikeForumPost, commentOnForumPost, getForumDetail, repostForumPost, deleteForumPost, editForumPost } from '../../services/api';

const forumLogo = require('../../assets/images/wny_logo.jpg');

const orgInfo = {
  name: 'CCICT Forum',
  username: '@CCICT_FORUM',
  bio: 'CCICT Forum CTU Main-Campus',
  profile_pic: forumLogo,
};

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  type?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  user: { user_id: number; f_name: string; l_name: string; profile_pic?: string | null };
}

interface UserProfile {
  profile_pic?: string;
}

export default function CCICTPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostActionSheet, setShowPostActionSheet] = useState(false);
  const [postActionForId, setPostActionForId] = useState<number | null>(null);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState<string>('');
  const [actionLoadingPostId, setActionLoadingPostId] = useState<number | null>(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [followStatusByUserId, setFollowStatusByUserId] = useState<Record<number, boolean>>({});
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any | null>(null);
  const [viewPostId, setViewPostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks < 5) return `${diffWeeks}w`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) return `${diffMonths}mo`;
      const diffYears = Math.floor(diffDays / 365);
      return `${diffYears}y`;
    } catch {
      return '';
    }
  };

  async function loadForumPosts() {
      try {
        const userInfo = await getUserInfo();
        setUser(userInfo);
      const meId = (userInfo as any)?.id || (userInfo as any)?.user_id || null;
      setCurrentUserId(meId);
        const forumPosts = await getForumPosts();
        setPosts(forumPosts as PostItem[]);
      try {
        const authorIds: number[] = Array.from(new Set<number>((forumPosts as PostItem[])
          .map((p: PostItem) => p.user?.user_id)
          .filter((x): x is number => typeof x === 'number')));
        const statuses = await Promise.all(authorIds.map(async (uid: number) => {
          if (!uid || (meId && uid === meId)) return [uid, true] as [number, boolean];
          try { const s = await checkFollowStatus(uid); return [uid, !!s?.is_following] as [number, boolean]; } catch { return [uid, false] as [number, boolean]; }
        }));
        const map: Record<number, boolean> = {};
        statuses.forEach(([uid, val]) => { if (uid) map[uid] = val; });
        setFollowStatusByUserId(map);
      } catch {}
      } catch (e) {
        setUser(null);
        setPosts([]);
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => { loadForumPosts(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadForumPosts(); } finally { setRefreshing(false); }
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1e3a8a"]} tintColor="#1e3a8a" />}
    >
      {/* Blue Header with Back Button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
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
      {/* Start a Post */}
      <View style={styles.startPostCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={user && user.profile_pic ? { uri: (String(user.profile_pic).startsWith('http') || String(user.profile_pic).startsWith('data:')) ? String(user.profile_pic) : `${API_BASE_URL}${user.profile_pic}` } : require('../../assets/images/sample_pic.jpg')} style={styles.avatar} />
          <TouchableOpacity style={styles.startPostInput} onPress={() => router.push({ pathname: '/posts/post', params: { type: 'forum' } })}>
            <Text style={{ color: '#888' }}>Start a post</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Posts */}
      {loading ? null : posts.map((post) => (
        <View key={post.post_id} style={styles.postCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Image source={post.user?.profile_pic ? { uri: (String(post.user.profile_pic).startsWith('http') || String(post.user.profile_pic).startsWith('data:')) ? String(post.user.profile_pic) : `${API_BASE_URL}${post.user.profile_pic}` } : orgInfo.profile_pic} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.postName}>{post.user?.f_name} {post.user?.l_name}</Text>
              <Text style={styles.postMeta}>{formatDate(post.created_at)} • <FontAwesome name="globe" size={12} color="#888" /></Text>
            </View>
            {(() => { try {
              const meId = currentUserId;
              const authorId = (post as any)?.user?.user_id;
              if (meId && authorId === meId) {
                // Own post: show ellipsis actions
                return (
                  <TouchableOpacity
                    onPress={() => { setPostActionForId(post.post_id); setEditPostContent(post.post_content || ''); setShowPostActionSheet(true); }}
                    style={{ padding: 6 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <FontAwesome name="ellipsis-h" size={18} color="#888" />
                  </TouchableOpacity>
                );
              }
              // Not own post: show Follow if not followed; else nothing
              const isFollowing = !!followStatusByUserId[authorId as number];
              if (authorId && !isFollowing) {
                return (
                  <TouchableOpacity
                    onPress={async () => { try { await followUser(authorId); setFollowStatusByUserId(prev => ({ ...prev, [authorId]: true })); Alert.alert('Followed', `You followed ${post.user.f_name} ${post.user.l_name}`); } catch { Alert.alert('Error', 'Failed to follow'); } }}
                    style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#E6F0FF', borderRadius: 16 }}
                  >
                    <Text style={{ color: '#1C4E80', fontWeight: '600' }}>Follow</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            } catch { return null; } })()}
          </View>
          {post.post_title ? <Text style={styles.postName}>{post.post_title}</Text> : null}
          <Text style={styles.postContent}>{post.post_content}</Text>
          {post.post_image ? (<Image source={{ uri: (String(post.post_image).startsWith('http') || String(post.post_image).startsWith('data:')) ? String(post.post_image) : `${API_BASE_URL}${post.post_image}` }} style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 8 }} />) : null}
          {/* Counts row, open viewers */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 }}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/posts/comments', params: { postId: String(post.post_id) } })}>
              <Text style={{ fontSize: 12, color: '#666' }}>{post.likes_count || 0} {(post.likes_count || 0) === 1 ? 'like' : 'likes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}>
              <Text style={{ fontSize: 12, color: '#666' }}>{post.comments_count || 0} {(post.comments_count || 0) === 1 ? 'comment' : 'comments'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: '/posts/comments', params: { postId: String(post.post_id) } })}>
              <Text style={{ fontSize: 12, color: '#666' }}>{post.reposts_count || 0} {(post.reposts_count || 0) === 1 ? 'share' : 'shares'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.postActions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              disabled={actionLoadingPostId === post.post_id}
              onPress={async () => {
                if (actionLoadingPostId === post.post_id) return;
                setActionLoadingPostId(post.post_id);
                // Optimistic toggle
                setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, is_liked: !p.is_liked, likes_count: Math.max(0, (p.likes_count||0) + (p.is_liked ? -1 : 1)) } : p));
                try {
                  if (post.is_liked) await unlikeForumPost(post.post_id); else await likeForumPost(post.post_id);
                } catch (e) {
                  // revert on error
                  setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, is_liked: !p.is_liked, likes_count: Math.max(0, (p.likes_count||0) + (p.is_liked ? -1 : 1)) } : p));
                  Alert.alert('Error', 'Failed to update like');
                } finally {
                  setActionLoadingPostId(null);
                }
              }}
            >
              <FontAwesome name={post.is_liked ? 'thumbs-up' : 'thumbs-o-up'} size={16} color="#888" />
              <Text style={styles.actionText}>{post.likes_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => router.push(`/posts/comments?postId=${post.post_id}`)}
            >
              <FontAwesome name="comment-o" size={16} color="#888" />
              <Text style={styles.actionText}>{post.comments_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  await repostForumPost(post.post_id);
                  try { const detail = await getForumDetail(post.post_id); setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, reposts_count: detail?.reposts_count ?? (p.reposts_count||0) } : p)); } catch {}
                  Alert.alert('Reposted', 'Post reposted successfully');
                } catch (e) {
                  Alert.alert('Error', 'Failed to repost');
                }
              }}
            >
              <FontAwesome name="retweet" size={16} color="#888" />
              <Text style={styles.actionText}>{post.reposts_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {/* Viewer Modal */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '92%', maxWidth: 420 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{viewerType === 'likes' ? 'Likes' : viewerType === 'reposts' ? 'Reposts' : 'Comments'}</Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320, marginTop: 8 }}>
              {viewerType === 'likes' && (selectedPostStats?.likes || []).map((u: any, idx: number) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <Image source={{ uri: (u.profile_pic && (String(u.profile_pic).startsWith('http') || String(u.profile_pic).startsWith('data:'))) ? u.profile_pic : (u.profile_pic ? `${API_BASE_URL}${u.profile_pic}` : '') }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ef', marginRight: 10 }} />
                  <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>{u.f_name || ''} {u.l_name || ''}</Text>
                </View>
              ))}
              {viewerType === 'reposts' && (selectedPostStats?.reposts || []).map((r: any) => (
                <View key={r.repost_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <Image source={{ uri: (r.user?.profile_pic && (String(r.user.profile_pic).startsWith('http') || String(r.user.profile_pic).startsWith('data:'))) ? r.user?.profile_pic : (r.user?.profile_pic ? `${API_BASE_URL}${r.user.profile_pic}` : '') }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ef', marginRight: 10 }} />
                  <View>
                    <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>{r.user?.f_name || ''} {r.user?.l_name || ''}</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>{r.repost_date ? new Date(r.repost_date).toLocaleString() : ''}</Text>
                  </View>
                </View>
              ))}
              {viewerType === 'comments' && (selectedPostStats?.comments || []).map((c: any) => (
                <View key={c.comment_id} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 }}>
                  <Image source={{ uri: c.user?.profile_pic || '' }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ef', marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>{c.user?.f_name || ''} {c.user?.l_name || ''}</Text>
                    <Text style={{ color: '#333' }}>{c.comment_content}</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>{c.date_created ? new Date(c.date_created).toLocaleString() : ''}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            {viewerType === 'comments' && selectedPostStats?.post_id && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <TextInput
                  style={{ flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f9f9f9' }}
                  placeholder="Write a comment..."
                  value={commentText}
                  onChangeText={setCommentText}
                />
            <TouchableOpacity 
                  style={{ backgroundColor: '#1e3a8a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginLeft: 8 }}
              onPress={async () => {
                    const msg = (commentText || '').trim();
                    if (!msg) return;
                    try { await commentOnForumPost(selectedPostStats.post_id, msg); setCommentText(''); const detail = await getForumDetail(selectedPostStats.post_id); setSelectedPostStats(detail); setPosts(prev => prev.map(p => p.post_id === selectedPostStats.post_id ? { ...p, comments_count: (p.comments_count||0)+1 } : p)); } catch { Alert.alert('Error', 'Failed to add comment'); }
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Send</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      {/* Post actions sheet */}
      <Modal visible={showPostActionSheet} transparent animationType="fade" onRequestClose={() => setShowPostActionSheet(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '92%', maxWidth: 420 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Select Action</Text>
              <TouchableOpacity onPress={() => setShowPostActionSheet(false)}>
                <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ paddingVertical: 12 }}
              onPress={() => { setShowPostActionSheet(false); if (postActionForId != null) setEditingPostId(postActionForId); }}
            >
              <Text style={{ fontSize: 16, color: '#174f84', fontWeight: '600' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 12 }}
              onPress={() => { setShowPostActionSheet(false); const id = postActionForId; if (id!=null) { Alert.alert('Delete Post','Are you sure you want to delete this post?',[{ text:'Cancel', style:'cancel' }, { text:'Delete', style:'destructive', onPress: async ()=>{ try { const { deleteForumPost, getForumPosts } = await import('../../services/api'); await deleteForumPost(id); const forumPosts = await getForumPosts(); setPosts(forumPosts); } catch { Alert.alert('Error','Failed to delete'); } } }]); } }}
            >
              <Text style={{ fontSize: 16, color: 'red', fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
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
    marginRight: 10,
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
});

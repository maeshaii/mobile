import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import { followUser, getUserInfo, checkFollowStatus, getForumPosts, getAlumniByBatch } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import ForumPostCard from './ForumPostCard';
import RepostCard from '../repost/RepostCard';

const forumLogo = require('../../assets/images/wny_logo.jpg');

const orgInfo = {
  name: 'CCICT Forum',
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
  f_name?: string;
  l_name?: string;
}

export default function CCICTPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersYear, setMembersYear] = useState<string | null>(null);

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
      // Determine user's batch year and load members of the same batch
      const batchYear = String((userInfo as any)?.batch || (userInfo as any)?.year_graduated || (userInfo as any)?.batch_year || '').trim();
      if (batchYear) {
        setMembersYear(batchYear);
        const list = await getAlumniByBatch(batchYear);
        setMembers(list);
      } else {
        setMembersYear(null);
        setMembers([]);
      }
        const forumPosts = await getForumPosts();
        console.log('Forum page - Raw forum posts:', forumPosts);
        const feedItems: any[] = [];
        (Array.isArray(forumPosts) ? forumPosts : []).forEach((f: any) => {
          // original forum post
          feedItems.push({ ...f, item_type: 'forum' });
          // include forum reposts as separate feed items (forum-only)
          const reposts = Array.isArray(f.reposts) ? f.reposts : [];
          reposts.forEach((r: any) => {
            feedItems.push({ ...r, item_type: 'repost' });
          });
        });
        const sorted = feedItems.sort((a, b) =>
          new Date(b.repost_date || b.created_at).getTime() - new Date(a.repost_date || a.created_at).getTime()
        );
        setPosts(sorted);
      } catch (e) {
        setUser(null);
        setPosts([]);
        setMembers([]);
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
      </View>

      {/* About Card */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>About</Text>
        <Text style={styles.aboutText}>
        Connect with fellow alumni from your batch and share experiences, memories, and updates about your journey after graduation.
        </Text>
      </View>


      
      {/* Members Card */}
      {membersYear && (
        <View style={styles.membersCard}>
          <Text style={styles.membersTitle}>Members · Batch {membersYear}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {members.map((m, idx) => {
              const memberId = m?.user_id || m?.id;
              const displayName = (m?.name || `${m?.f_name || m?.first_name || ''} ${m?.l_name || m?.last_name || ''}`).trim();
              const nameParts = (displayName || '').split(/\s+/);
              const fn = nameParts[0] || '';
              const ln = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.memberItem}
                  onPress={() => {
                    if (memberId) {
                      router.push(`/otheruser/otheruser?viewUserId=${memberId}`);
                    }
                  }}
                >
                  <UserAvatar
                    profilePic={m.profile_pic}
                    firstName={fn}
                    lastName={ln}
                    size={48}
                  />
                  <Text numberOfLines={1} style={styles.memberName}>
                    {displayName || 'User'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {members.length === 0 && (
              <Text style={{ color: '#666', paddingVertical: 8 }}>No members found for this batch.</Text>
            )}
          </ScrollView>
        </View>
      )}
      {/* Start a Post */}
      <View style={styles.startPostCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <UserAvatar 
            profilePic={user?.profile_pic}
            firstName={user?.f_name}
            lastName={user?.l_name}
            size={40}
            style={styles.avatar}
          />
          <TouchableOpacity style={styles.startPostInput} onPress={() => router.push({ pathname: '/posts/post', params: { type: 'forum' } })}>
            <Text style={{ color: '#888' }}>Start a post</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Feed: forum posts and forum reposts (forum-only) */}
      {loading ? null : posts.map((item) => {
        if (item?.item_type === 'repost' || typeof item?.repost_id === 'number') {
          return (
            <RepostCard
              key={`forum-repost-${item.repost_id}`}
              repost={item}
              currentUserId={currentUserId || undefined}
              onLikeToggle={(repostId: number, liked: boolean) => {
                setPosts(prev => prev.map(p => (p.repost_id === repostId ? { ...p, is_liked: liked, likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)) } : p)));
              }}
              onOpenViewer={() => { /* viewer not wired for forum reposts */ }}
              onEdited={(repostId: number, newCaption: string) => {
                setPosts(prev => prev.map(p => (p.repost_id === repostId ? { ...p, repost_caption: newCaption } : p)));
              }}
              onDeleted={(repostId: number) => {
                setPosts(prev => prev.filter(p => p.repost_id !== repostId));
              }}
              onOriginalPostReposted={() => {}}
            />
          );
        }
        return (
          <ForumPostCard
            key={`forum-post-${item.post_id}`}
            post={item}
            currentUserId={currentUserId || undefined}
            onLikeToggle={(postId, isLiked) => {
              setPosts(prev => prev.map(p =>
                p.post_id === postId
                  ? { ...p, is_liked: isLiked, likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) }
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
                p.post_id === postId
                  ? { ...p, post_content: newContent }
                  : p
              ));
            }}
            onDeleted={(postId) => {
              setPosts(prev => prev.filter(p => p.post_id !== postId));
            }}
          />
        );
      })}

      {/* Likes/Reposts Viewer Modal */}
      <Modal visible={viewerVisible} transparent animationType="slide" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>
                {viewerType === 'likes' ? 'Likes' : viewerType === 'reposts' ? 'Reposts' : 'Comments'}
              </Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {viewerType === 'likes' && selectedPostStats?.likes?.map((u: any, idx: number) => (
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
              ))}

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
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxHeight: '80%',
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
  aboutCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#174f84',
    marginBottom: 6,
  },
  aboutText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 10,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  aboutLabel: {
    fontSize: 13,
    color: '#666',
  },
  aboutValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  membersCard: {
    backgroundColor: '#fff',
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#174f84',
  },
  memberItem: {
    alignItems: 'center',
    marginRight: 12,
    width: 80,
  },
  memberName: {
    marginTop: 6,
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});

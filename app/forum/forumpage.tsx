import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput, ActivityIndicator } from 'react-native';
import { followUser, getUserInfo, checkFollowStatus, getForumPosts, getAlumniByBatch, getPostLikes, getPostReposts, getRepostComments, commentOnRepost, getRepostDetail, API_BASE_URL } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import ForumPostCard from './ForumPostCard';
import RepostCard from '../repost/RepostCard';
import MentionInput from '../../components/MentionInput';
import { renderTextWithMentions } from '../../utils/mentionUtils';

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

  // Repost comment modal state (dashboard-style)
  const [repostCommentModalVisible, setRepostCommentModalVisible] = useState(false);
  const [selectedRepost, setSelectedRepost] = useState<any>(null);
  const [repostCommentText, setRepostCommentText] = useState('');
  const [submittingRepostComment, setSubmittingRepostComment] = useState(false);
  const [repostComments, setRepostComments] = useState<any[]>([]);
  const [repostCommentsLoading, setRepostCommentsLoading] = useState(false);

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

  const renderAvatar = (src: string | null | undefined) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
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
            feedItems.push({
              ...r,
              item_type: 'repost',
              original_post: {
                post_id: f.post_id,
                post_title: f.post_title,
                post_content: f.post_content,
                post_image: f.post_image,
                post_images: f.post_images,
                user: f.user || { user_id: 0, f_name: 'Unknown', l_name: 'User', profile_pic: null },
                created_at: f.created_at,
                likes_count: f.likes_count || 0,
                comments_count: f.comments_count || 0,
                reposts_count: f.reposts_count || 0,
                is_liked: f.is_liked || false,
              }
            });
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

  // Repost comment functions (dashboard-style)
  const loadRepostComments = async (repostId: number) => {
    try {
      setRepostCommentsLoading(true);
      const data = await getRepostComments(repostId);
      setRepostComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (error) {
      console.error('Error loading repost comments:', error);
      setRepostComments([]);
    } finally {
      setRepostCommentsLoading(false);
    }
  };

  const handleRepostComment = async () => {
    const message = (repostCommentText || '').trim();
    if (!message || !selectedRepost) return;
    try {
      setSubmittingRepostComment(true);
      await commentOnRepost(selectedRepost.repost_id, message);
      const data = await getRepostComments(selectedRepost.repost_id);
      const newComments = data?.comments || [];
      setRepostComments(newComments);
      setRepostCommentText('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingRepostComment(false);
    }
  };

  const openRepostCommentModal = async (repost: any) => {
    try {
      setRepostCommentModalVisible(true);
      setRepostCommentsLoading(true);
      
      // Fetch both repost details and comments
      const [repostData, commentsData] = await Promise.all([
        getRepostDetail(repost.repost_id),
        getRepostComments(repost.repost_id)
      ]);
      
      console.log('Repost details:', repostData);
      console.log('Repost comments:', commentsData);
      console.log('Repost user data:', repostData?.user);
      console.log('Repost original data:', repostData?.original);
      
      // Set the detailed repost data
      setSelectedRepost(repostData);
      
      // Set comments
      const commentsArray = Array.isArray(commentsData?.comments) ? commentsData.comments : [];
      setRepostComments(commentsArray);
      
    } catch (error) {
      console.error('Error loading repost data:', error);
      Alert.alert('Error', 'Failed to load repost data');
      setRepostCommentModalVisible(false);
    } finally {
      setRepostCommentsLoading(false);
    }
  };

  useEffect(() => { loadForumPosts(); }, []);

  // Refresh forum posts when user returns to this screen (e.g., from comments, reposts)
  useFocusEffect(
    useCallback(() => {
      loadForumPosts();
    }, [])
  );

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
              isForum
              onLikeToggle={(repostId: number, liked: boolean) => {
                setPosts(prev => prev.map(p => (p.repost_id === repostId ? { ...p, is_liked: liked, likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)) } : p)));
              }}
              onOpenViewer={async (repost, type) => {
                try {
                  if (type === 'comments') {
                    // Open repost comments modal (dashboard-style)
                    await openRepostCommentModal(repost);
                  } else if (type === 'likes' || type === 'reposts') {
                    setSelectedPostStats(repost);
                    setViewerType(type);
                    setViewerVisible(true);

                    // Fetch fresh data for the viewer
                    if (type === 'likes') {
                      const likesData = await getPostLikes(repost.repost_id);
                      setSelectedPostStats((prev: any) => ({ ...prev, likes: likesData || [] }));
                    } else if (type === 'reposts') {
                      const repostsData = await getPostReposts(repost.repost_id);
                      setSelectedPostStats((prev: any) => ({ ...prev, reposts: repostsData || [] }));
                    }
                  }
                } catch (error) {
                  console.error('Error fetching viewer data:', error);
                  Alert.alert('Error', 'Failed to load data');
                }
              }}
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
              // Auto-refresh forum posts after like/unlike
              setTimeout(() => loadForumPosts(), 500);
            }}
            onOpenViewer={async (post, type) => {
              try {
                if (type === 'comments') {
                  // Navigate to full-screen comments page for forum posts
                  router.push({
                    pathname: '/posts/comments',
                    params: {
                      postId: post.post_id,
                      isForumPost: 'true'
                    }
                  });
                } else {
                  // Keep modal for likes and reposts
                  setSelectedPostStats(post);
                  setViewerType(type);
                  setViewerVisible(true);

                  // Fetch fresh data for the viewer
                  if (type === 'likes') {
                    const likesData = await getPostLikes(post.post_id);
                    setSelectedPostStats((prev: any) => ({ ...prev, likes: likesData || [] }));
                  } else if (type === 'reposts') {
                    const repostsData = await getPostReposts(post.post_id);
                    setSelectedPostStats((prev: any) => ({ ...prev, reposts: repostsData || [] }));
                  }
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
              // Auto-refresh forum posts after edit
              setTimeout(() => loadForumPosts(), 500);
            }}
            onDeleted={(postId) => {
              setPosts(prev => prev.filter(p => p.post_id !== postId));
              // Auto-refresh forum posts after delete
              setTimeout(() => loadForumPosts(), 500);
            }}
            onRepostToggle={(postId, reposted) => {
              setPosts(prev => prev.map(p =>
                p.post_id === postId
                  ? { ...p, reposts_count: Math.max(0, (p.reposts_count || 0) + (reposted ? 1 : -1)) }
                  : p
              ));
              // Auto-refresh forum posts after repost
              setTimeout(() => loadForumPosts(), 500);
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
                {viewerType === 'likes' ? 'Likes' : 'Reposts'}
              </Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}
            >
              {viewerType === 'likes' && Array.isArray(selectedPostStats?.likes) && selectedPostStats.likes.map((u: any, idx: number) => (
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

              {viewerType === 'reposts' && Array.isArray(selectedPostStats?.reposts) && selectedPostStats.reposts.map((r: any) => (
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
                    <Text style={styles.listSubText}>{new Date(r.repost_date || r.created_at).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

          </View>
        </View>
      </Modal>

      {/* Repost Comments Modal (Dashboard-style) */}
      <Modal
        visible={repostCommentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRepostCommentModalVisible(false)}
      >
        <View style={styles.repostModalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.repostModalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setRepostCommentModalVisible(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {/* Repost Details */}
              {selectedRepost && (
                <View style={styles.repostDetails}>
                  <View style={styles.repostHeader}>
                    <UserAvatar
                      profilePic={selectedRepost.user?.profile_pic}
                      firstName={selectedRepost.user?.f_name}
                      lastName={selectedRepost.user?.l_name}
                      size={32}
                      style={styles.commentAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentName}>
                        {`${selectedRepost.user?.f_name || ''} ${selectedRepost.user?.l_name || ''}`.trim() || 'User'}
                      </Text>
                      <Text style={styles.commentMeta}>
                        {selectedRepost.repost_date ? new Date(selectedRepost.repost_date).toLocaleString() : ''}
                      </Text>
                    </View>
                  </View>
                  {selectedRepost.caption && (
                    <View style={styles.commentBubble}>
                      <Text style={{ color: '#111827' }}>{selectedRepost.caption}</Text>
                    </View>
                  )}
                  {selectedRepost.original && (
                    <TouchableOpacity 
                      style={styles.originalPostPreview}
                      onPress={() => {
                        // Navigate to the original post detail page
                        if (selectedRepost.original?.post_id) {
                          console.log('Navigating to original post detail:', selectedRepost.original.post_id);
                          router.push(`/posts/detail?postId=${selectedRepost.original.post_id}&isForumPost=true`);
                        } else if (selectedRepost.original?.forum_id) {
                          console.log('Navigating to original forum detail:', selectedRepost.original.forum_id);
                          router.push(`/posts/detail?postId=${selectedRepost.original.forum_id}&isForumPost=true`);
                        } else if (selectedRepost.original?.donation_id) {
                          console.log('Navigating to original donation detail:', selectedRepost.original.donation_id);
                          router.push(`/posts/detail?postId=${selectedRepost.original.donation_id}`);
                        }
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.originalPostLabel}>Reposted:</Text>
                        <Text style={styles.originalPostContent}>
                          {selectedRepost.original.content || selectedRepost.original.post_content || 'Original post content unavailable'}
                        </Text>
                      </View>
                      <View style={styles.originalPostArrow}>
                        <Ionicons name="chevron-forward" size={16} color="#174f84" />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {repostCommentsLoading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#1e3a8a" />
                </View>
              ) : repostComments.length === 0 ? (
                <View style={{ padding: 20 }}>
                  <Text style={{ color: '#666', textAlign: 'center' }}>No comments yet</Text>
                </View>
              ) : (
                repostComments.map((comment) => (
                  <View key={comment.comment_id} style={styles.commentRow}>
                    <Image source={{ uri: comment.user?.profile_pic || 'https://randomuser.me/api/portraits/women/46.jpg' }} style={styles.commentAvatar} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.commentHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commentName}>{comment.user?.f_name} {comment.user?.l_name}</Text>
                          <Text style={styles.commentMeta}>{new Date(comment.date_created).toLocaleString()}</Text>
                        </View>
                      </View>
                      <View style={styles.commentBubble}>
                        {renderTextWithMentions(comment.comment_content, [], (userId) => {
                          router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                        })}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {selectedRepost && (
              <View style={styles.commentInputRow}>
                <MentionInput
                  value={repostCommentText}
                  onChange={setRepostCommentText}
                  placeholder="Write a comment..."
                  style={styles.commentInput}
                />
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={handleRepostComment}
                  disabled={!repostCommentText.trim() || submittingRepostComment}
                >
                  {submittingRepostComment ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
  // Repost comment modal styles
  repostModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repostModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentName: {
    fontWeight: '600',
    color: '#111827',
  },
  commentMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  commentBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
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
    backgroundColor: '#174f84',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
  // Repost details styles
  repostDetails: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9f9f9',
  },
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPostPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#174f84',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  originalPostLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#174f84',
    marginBottom: 4,
  },
  originalPostContent: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    flex: 1,
  },
  originalPostArrow: {
    marginLeft: 8,
  },
});

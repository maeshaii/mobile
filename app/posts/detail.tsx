import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { getPostDetail, getUserInfo, followUser, unfollowUser, checkFollowStatus, commentOnPost, getPostComments, updateComment, deleteComment, likePost, unlikePost, repostPost, API_BASE_URL } from '../../services/api';
import PostCard from './postCard';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const postId = typeof params.postId === 'string' ? parseInt(params.postId) : undefined;
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'reposts' | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [actionFor, setActionFor] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      console.log('Loading post detail for postId:', postId);
      const [detail, user] = await Promise.all([
        getPostDetail(postId),
        getUserInfo()
      ]);
      console.log('Post detail loaded:', detail);
      setPost(detail);
      setMe(user);
      
      // Check follow status
      if (detail?.user?.user_id && user?.user_id) {
        try {
          const followStatus = await checkFollowStatus(detail.user.user_id);
          setIsFollowing(followStatus.is_following);
        } catch (error) {
          console.error('Error checking follow status:', error);
        }
      }
      
      // Check if post is liked
      if (detail?.likes && Array.isArray(detail.likes)) {
        const meId = user?.id || user?.user_id;
        setIsLiked(detail.likes.some((like: any) => (like.user_id || like.user?.user_id) === meId));
      }
      
      // Load comments
      await loadComments();
    } catch (error) {
      console.error('Error loading post detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!postId) return;
    try {
      const data = await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    }
  };

  const handleFollow = async () => {
    if (!post?.user?.user_id || followLoading) return;
    
    try {
      setFollowLoading(true);
      if (isFollowing) {
        await unfollowUser(post.user.user_id);
        setIsFollowing(false);
      } else {
        await followUser(post.user.user_id);
        setIsFollowing(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!postId || !commentText.trim()) return;
    try {
      setSubmittingComment(true);
      await commentOnPost(postId, commentText.trim());
      setCommentText('');
      await loadComments();
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editText.trim()) return;
    try {
      await updateComment(postId!, commentId, editText.trim());
      setEditingId(null);
      setEditText('');
      await loadComments();
    } catch {
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(postId!, commentId);
      await loadComments();
    } catch {
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const renderAvatar = (src?: string) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  const renderImage = (src?: string) => {
    if (!src) return null;
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  const meId = me?.id || me?.user_id;

  useEffect(() => { load(); }, [postId]);

  if (!postId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1f2937" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Missing postId</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1f2937" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1f2937" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Post not found</Text>
          <Text style={styles.errorSubtitle}>
            The post you're looking for doesn't exist or you don't have permission to view it.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1f2937" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />
      <ScrollView style={styles.content}>
        {/* Post Header with Follow Button */}
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <View style={styles.avatarContainer}>
              <Image source={renderAvatar(post.user?.profile_pic)} style={styles.authorAvatar} />
            </View>
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>
                {`${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User'}
              </Text>
              <Text style={styles.postTime}>{dayjs(post.created_at).fromNow()}</Text>
            </View>
          </View>
          {post.user?.user_id !== meId && (
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Post Content */}
        <View style={styles.postContent}>
          {post.post_title && <Text style={styles.postTitle}>{post.post_title}</Text>}
          <Text style={styles.postText}>{post.post_content}</Text>
          {post.post_image && renderImage(post.post_image) && (
            <Image source={renderImage(post.post_image)!} style={styles.postImage} resizeMode="cover" />
          )}
        </View>

        {/* Viewers Section */}
        <View style={styles.viewersSection}>
          <TouchableOpacity
            style={styles.viewerButton}
            onPress={() => {
              setSelectedPost(post);
              setViewerType('likes');
              setViewerVisible(true);
            }}
          >
            <Text style={styles.viewerButtonText}>
              View {post.likes_count || 0} {post.likes_count === 1 ? 'like' : 'likes'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.viewerButton}
            onPress={() => {
              setSelectedPost(post);
              setViewerType('reposts');
              setViewerVisible(true);
            }}
          >
            <Text style={styles.viewerButtonText}>
              View {post.reposts_count || 0} {post.reposts_count === 1 ? 'share' : 'shares'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => {
              if (!postId || actionLoading) return;
              try {
                setActionLoading(true);
                if (isLiked) {
                  await unlikePost(postId);
                  setIsLiked(false);
                  // Update post data
                  const updatedPost = await getPostDetail(postId);
                  setPost(updatedPost);
                } else {
                  await likePost(postId);
                  setIsLiked(true);
                  // Update post data
                  const updatedPost = await getPostDetail(postId);
                  setPost(updatedPost);
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to update like');
              } finally {
                setActionLoading(false);
              }
            }}
          >
            <FontAwesome 
              name={isLiked ? "thumbs-up" : "thumbs-o-up"} 
              size={18} 
              color={isLiked ? "#1e3a8a" : "#555"} 
            />
            <Text style={[styles.actionText, isLiked && { color: '#1e3a8a' }]}>
              {post.likes_count || 0} {post.likes_count === 1 ? 'like' : 'likes'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Scroll to comments section
            }}
          >
            <FontAwesome name="comment-o" size={18} color="#555" />
            <Text style={styles.actionText}>
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => {
              if (!postId || actionLoading) return;
              try {
                setActionLoading(true);
                await repostPost(postId);
                Alert.alert('Success', 'Post shared successfully!');
                // Update post data
                const updatedPost = await getPostDetail(postId);
                setPost(updatedPost);
              } catch (error) {
                Alert.alert('Error', 'Failed to share post');
              } finally {
                setActionLoading(false);
              }
            }}
          >
            <FontAwesome name="retweet" size={18} color="#555" />
            <Text style={styles.actionText}>
              {post.reposts_count || 0} {post.reposts_count === 1 ? 'share' : 'shares'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.length === 0 ? (
            <View style={{ padding: 20 }}>
              <Text style={styles.emptyText}>No comments yet</Text>
            </View>
          ) : (
            comments.map((c) => {
              const isMine = c.user.user_id === meId;
              const isPostOwner = post?.user?.user_id === meId || post?.user?.id === meId;
              const canManage = isMine || isPostOwner;
              const isEditing = editingId === c.comment_id;

              return (
                <TouchableOpacity
                  key={c.comment_id}
                  onLongPress={() => setActionFor(c)}
                  delayLongPress={300}
                  activeOpacity={1}
                >
                  <View style={styles.commentRow}>
                    <Image source={renderAvatar(c.user?.profile_pic)} style={styles.commentAvatar} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.commentName}>
                          {`${c.user?.f_name || ''} ${c.user?.l_name || ''}`.trim() || 'User'}
                        </Text>
                        {!!c.date_created && (
                          <Text style={styles.commentMeta}>{dayjs(c.date_created).fromNow()}</Text>
                        )}
                        {canManage && !isEditing && (
                          <TouchableOpacity onPress={() => setActionFor(c)} style={{ padding: 4 }}>
                            <Ionicons name="ellipsis-horizontal" size={16} color="#6b7280" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {isEditing ? (
                        <View style={styles.editBox}>
                          <TextInput
                            style={styles.editInput}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                          />
                          <View style={styles.editActions}>
                            <TouchableOpacity onPress={() => handleUpdateComment(c.comment_id)} style={styles.sendBtn}>
                              <Text style={styles.sendBtnText}>Update</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditingId(null)} style={styles.backBtn}>
                              <Text style={styles.backText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.commentBubble}>
                          <Text style={styles.commentText}>{c.comment_content}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.commentInputContainer}
      >
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor="#9ca3af"
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSendComment}
          />
          <TouchableOpacity
            disabled={!commentText.trim() || submittingComment}
            onPress={handleSendComment}
            style={[styles.sendButton, (!commentText.trim() || submittingComment) && { opacity: 0.5 }]}
          >
            {submittingComment ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Viewer Modal */}
      {viewerVisible && selectedPost && (
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerModal}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerTitle}>
                {viewerType === 'likes' ? 'Likes' : viewerType === 'reposts' ? 'Shares' : 'Viewer'}
              </Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <View style={styles.viewerContent}>
              {viewerType === 'likes' && selectedPost.likes && selectedPost.likes.map((like: any, index: number) => (
                <View key={index} style={styles.viewerItem}>
                  <Text style={styles.viewerItemText}>
                    {like.user?.f_name} {like.user?.l_name}
                  </Text>
                </View>
              ))}
              {viewerType === 'reposts' && selectedPost.reposts && selectedPost.reposts.map((repost: any, index: number) => (
                <View key={index} style={styles.viewerItem}>
                  <Text style={styles.viewerItemText}>
                    {repost.user?.f_name} {repost.user?.l_name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Action Popup Modal */}
      {actionFor && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>Comment Actions</Text>

            {/* Edit: only show if comment is mine */}
            {actionFor.user?.user_id === meId && (
              <TouchableOpacity
                style={styles.popupButton}
                onPress={() => {
                  setEditingId(actionFor.comment_id);
                  setEditText(actionFor.comment_content);
                  setActionFor(null);
                }}
              >
                <Text style={styles.popupButtonText}>✏️ Edit</Text>
              </TouchableOpacity>
            )}

            {/* Delete: show if comment is mine OR I am the post owner */}
            {(actionFor.user?.user_id === meId || post?.user?.user_id === meId || post?.user?.id === meId) && (
              <TouchableOpacity
                style={[styles.popupButton, { backgroundColor: '#fee2e2' }]}
                onPress={() => {
                  Alert.alert(
                    'Delete Comment',
                    'Are you sure you want to delete this comment? This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => handleDeleteComment(actionFor.comment_id),
                      },
                    ]
                  );
                  setActionFor(null);
                }}
              >
                <Text style={[styles.popupButtonText, { color: '#dc2626' }]}>🗑 Delete</Text>
              </TouchableOpacity>
            )}

            {/* Cancel: always show */}
            <TouchableOpacity
              style={[styles.popupButton, { backgroundColor: '#f3f4f6' }]}
              onPress={() => setActionFor(null)}
            >
              <Text style={[styles.popupButtonText, { color: '#111827' }]}>✖ Cancel</Text>
            </TouchableOpacity>
          </View>
      </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
  },
  content: {
    flex: 1,
    padding: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 18,
    marginBottom: 10,
    color: '#111827',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  viewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  viewerContent: {
    padding: 16,
  },
  viewerItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  viewerItemText: {
    fontSize: 16,
    color: '#111827',
  },
  
  // Post Header Styles
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  postTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  followButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: '#e5e7eb',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  followingButtonText: {
    color: '#374151',
  },
  
  // Post Content Styles
  postContent: {
    padding: 16,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  postText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#e5e7eb',
  },
  
  // Post Actions Styles
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  
  // Viewers Section Styles
  viewersSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  viewerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  viewerButtonText: {
    fontSize: 14,
    color: '#1e3a8a',
    fontWeight: '500',
  },
  
  // Comments Section Styles
  commentsSection: {
    padding: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  commentMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  commentBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  commentText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
  },
  
  // Comment Input Styles
  commentInputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  
  // Edit Comment Styles
  editBox: {
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: '#111827',
    minHeight: 40,
  },
  editActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    justifyContent: 'flex-end',
  },
  sendBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  backText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 12,
  },
  
  // Popup Modal Styles
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxWidth: 300,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  popupButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  popupButtonText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#111827',
  },
});



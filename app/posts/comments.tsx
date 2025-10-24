import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  API_BASE_URL,
  commentOnPost,
  deleteComment,
  getPostComments,
  getPostDetail,
  getPosts,
  getUserInfo,
  updateComment,
  commentOnForumPost,
  getForumComments,
  updateForumComment,
  deleteForumComment,
  getForumDetail,
  commentOnDonationPost,
  getDonationComments,
  updateDonationComment,
  deleteDonationComment,
  getDonationDetail,
  getCommentReplies,
  createCommentReply,
  updateCommentReply,
  deleteCommentReply,
} from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import MentionInput from '../../components/MentionInput';
import { renderTextWithMentions } from '../../utils/mentionUtils';

dayjs.extend(relativeTime);

type CommentItem = {
  comment_id: number;
  comment_content: string;
  date_created?: string;
  replies_count?: number;
  user: {
    user_id: number;
    f_name?: string;
    l_name?: string;
    profile_pic?: string;
  };
};

type ReplyItem = {
  reply_id: number;
  reply_content: string;
  date_created?: string;
  user: {
    user_id: number;
    f_name?: string;
    l_name?: string;
    profile_pic?: string;
  };
};

export default function PostCommentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = Number(params.postId);
  const isForumPost = params.isForumPost === 'true';
  const isDonationPost = params.isDonationPost === 'true';
  const highlightCommentId = params.highlightCommentId ? Number(params.highlightCommentId) : null;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [me, setMe] = useState<any>(null);

  const [actionFor, setActionFor] = useState<CommentItem | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);

  // Reply state management
  const [commentReplies, setCommentReplies] = useState<{ [commentId: number]: ReplyItem[] }>({});
  const [showReplies, setShowReplies] = useState<{ [commentId: number]: boolean }>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editReplyText, setEditReplyText] = useState('');
  
  // Image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(t);
  }, []);

  const renderAvatar = (src: string | null | undefined) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  // Load replies for comments that have replies when comments change
  useEffect(() => {
    if (comments.length > 0) {
      comments.forEach(comment => {
        if ((comment.replies_count || 0) > 0) {
          loadReplies(comment.comment_id);
          // Automatically show replies when they exist
          setShowReplies(prev => ({ ...prev, [comment.comment_id]: true }));
        }
      });
    }
  }, [comments]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
        const [postDetail, user] = await Promise.all([
          isForumPost ? getForumDetail(postId) : isDonationPost ? getDonationDetail(postId) : getPostDetail(postId), 
          getUserInfo()
        ]);
      setMe(user);
      
      // Normalize donation post data if it's a donation post
      let normalizedPost = postDetail;
      if (isDonationPost && postDetail) {
        normalizedPost = {
          post_id: postDetail.donation_id,
          post_title: postDetail.post_title || undefined,
          post_content: postDetail.description || postDetail.post_content || '',
          post_image: postDetail.post_image || (postDetail.images?.[0]?.image_url || null),
          post_images: postDetail.images || [],
          type: 'donation',
          created_at: postDetail.created_at,
          likes_count: postDetail.likes_count || 0,
          comments_count: postDetail.comments_count || 0,
          reposts_count: postDetail.reposts_count || 0,
          is_liked: !!postDetail.is_liked,
          user: postDetail.user || { user_id: 0, f_name: 'Unknown', l_name: 'User', profile_pic: null }
        };
      }
      
      setPost(normalizedPost || null);
      console.log('Comments - Post detail loaded:', postDetail);
      console.log('Comments - Normalized post:', normalizedPost);
      console.log('Comments - Post images:', postDetail?.post_images);
      console.log('Comments - Post image:', postDetail?.post_image);
      console.log('Comments - Post content:', postDetail?.post_content);
      console.log('Comments - Post description:', postDetail?.description);
      console.log('Comments - Post title:', postDetail?.post_title);
      console.log('Comments - Is forum post:', isForumPost);
      console.log('Comments - Is donation post:', isDonationPost);
      console.log('Comments - Post user:', postDetail?.user);
      console.log('Comments - Post user f_name:', postDetail?.user?.f_name);
      console.log('Comments - Post user l_name:', postDetail?.user?.l_name);

      const data = isForumPost ? await getForumComments(postId) : isDonationPost ? await getDonationComments(postId) : await getPostComments(postId);
      console.log('Comments - Comments data:', data);
      console.log('Comments - Comments array:', data?.comments);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
      
      // Highlight specific comment if provided
      if (highlightCommentId && data?.comments) {
        const commentExists = data.comments.some((c: CommentItem) => c.comment_id === highlightCommentId);
        if (commentExists) {
          setHighlightedCommentId(highlightCommentId);
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedCommentId(null);
          }, 3000);
        }
      }
    } catch (e) {
      console.error('[comments] load failed', e);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId, isForumPost, isDonationPost]);

  useEffect(() => {
    if (postId) load();
  }, [postId, load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = isForumPost ? await getForumComments(postId) : isDonationPost ? await getDonationComments(postId) : await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } finally {
      setRefreshing(false);
    }
  }, [postId, isForumPost, isDonationPost]);


  const meId = me?.id || me?.user_id;
  const canSend = !!postId && !!commentText.trim() && !submitting;

  async function handleSend() {
    if (!canSend) return;
    try {
      setSubmitting(true);
      if (isForumPost) {
        await commentOnForumPost(postId, commentText.trim());
      } else if (isDonationPost) {
        await commentOnDonationPost(postId, commentText.trim());
      } else {
        await commentOnPost(postId, commentText.trim());
      }
      setCommentText('');
      setInputHeight(44);
      await onRefresh();
    } catch (err: any) {
      console.error('[comments] send failed', err);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(commentId: number) {
    if (!editText.trim()) return;
    try {
      if (isForumPost) {
        await updateForumComment(postId, commentId, editText.trim());
      } else if (isDonationPost) {
        await updateDonationComment(postId, commentId, editText.trim());
      } else {
        await updateComment(postId, commentId, editText.trim());
      }
      setEditingId(null);
      setEditText('');
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to update comment');
    }
  }

  async function handleDelete(commentId: number) {
    try {
      if (isForumPost) {
        await deleteForumComment(postId, commentId);
      } else if (isDonationPost) {
        await deleteDonationComment(postId, commentId);
      } else {
        await deleteComment(postId, commentId);
      }
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to delete comment');
    }
  }

  // Reply functions
  async function loadReplies(commentId: number) {
    try {
      console.log('Loading replies for comment:', commentId);
      const response = await getCommentReplies(commentId);
      console.log('Replies response:', response);
      console.log('Number of replies received:', response.replies?.length || 0);
      setCommentReplies(prev => {
        const newReplies = { ...prev, [commentId]: response.replies || [] };
        console.log('Updated commentReplies state:', newReplies);
        return newReplies;
      });
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  }

  async function handleReplySubmit(commentId: number) {
    if (!replyText.trim() || submittingReply) return;
    
    setSubmittingReply(true);
    try {
      // Find the comment to get the user info for mention
      const comment = comments.find(c => c.comment_id === commentId);
      const mentionText = comment ? `@${comment.user?.f_name || 'User'} ` : '';
      const replyWithMention = `${mentionText}${replyText.trim()}`;
      
      await createCommentReply(commentId, replyWithMention);
      setReplyText('');
      setReplyingTo(null);
      // Show replies after submitting a new reply
      setShowReplies(prev => ({ ...prev, [commentId]: true }));
      await loadReplies(commentId);
    } catch (error) {
      console.error('Error submitting reply:', error);
      Alert.alert('Error', 'Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleReplyUpdate(commentId: number, replyId: number) {
    if (!editReplyText.trim()) return;
    
    try {
      await updateCommentReply(commentId, replyId, editReplyText.trim());
      setEditingReplyId(null);
      setEditReplyText('');
      await loadReplies(commentId);
    } catch (error) {
      Alert.alert('Error', 'Failed to update reply');
    }
  }

  async function handleReplyDelete(commentId: number, replyId: number) {
    try {
      await deleteCommentReply(commentId, replyId);
      await loadReplies(commentId);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete reply');
    }
  }

  function toggleReplies(commentId: number) {
    setShowReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
    
    // Load replies if not already loaded
    if (!commentReplies[commentId]) {
      loadReplies(commentId);
    }
  }

  const hideComposer = !!actionFor || editingId !== null || replyingTo !== null;
  const composerHeight = Math.min(Math.max(inputHeight, 44), 120);

  const commentCount = comments.length;
  const headerTitle = useMemo(() => `Comments · ${commentCount}`, [commentCount]);

  if (!postId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Invalid post</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.subtle}>Loading…</Text>
      </View>
    );
  }

  const renderComment = ({ item: c }: { item: CommentItem }) => {
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
          <UserAvatar 
            profilePic={c.user?.profile_pic}
            firstName={c.user?.f_name}
            lastName={c.user?.l_name}
            size={32}
            style={styles.cAvatar}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.cHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cName}>
                  {`${c.user?.f_name || ''} ${c.user?.l_name || ''}`.trim() || 'User'}
                </Text>
                {!!c.date_created && (
                  <Text style={styles.cMeta}>{dayjs(c.date_created).fromNow()}</Text>
                )}
              </View>
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
                  <TouchableOpacity onPress={() => handleUpdate(c.comment_id)} style={styles.sendBtn}>
                    <Text style={styles.sendBtnText}>Update</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingId(null)} style={styles.backBtn}>
                    <Text style={styles.backText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[
                styles.bubble,
                highlightedCommentId === c.comment_id && styles.highlightedBubble
              ]}>
                <Text style={styles.cBody}>
                  {renderTextWithMentions(c.comment_content, [], (userId) => {
                    router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                  })}
                </Text>
              </View>
            )}

            {/* Reply section */}
            {!isEditing && (
              <View style={styles.replySection}>
                {/* Reply button */}
                <TouchableOpacity 
                  style={styles.replyButton}
                  onPress={() => setReplyingTo(replyingTo === c.comment_id ? null : c.comment_id)}
                >
                  <Text style={styles.replyButtonText}>
                    {replyingTo === c.comment_id ? 'Cancel Reply' : 'Reply'}
                  </Text>
                </TouchableOpacity>

                {/* Show replies count and toggle */}
                {(c.replies_count || 0) > 0 && (
                  <TouchableOpacity 
                    style={styles.repliesToggle}
                    onPress={() => toggleReplies(c.comment_id)}
                  >
                    <Text style={styles.repliesToggleText}>
                      {showReplies[c.comment_id] ? 'Hide' : 'View'} {c.replies_count || 0} {(c.replies_count || 0) === 1 ? 'reply' : 'replies'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Reply input */}
                {replyingTo === c.comment_id && (
                  <View style={styles.replyInputContainer}>
                    <View style={styles.replyingToContainer}>
                      <Text style={styles.replyingToText}>
                        Replying to {c.user?.f_name || 'User'}
                      </Text>
                      <TouchableOpacity onPress={() => setReplyingTo(null)}>
                        <Ionicons name="close" size={16} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.replyInputRow}>
                      <MentionInput
                        value={replyText}
                        onChange={setReplyText}
                        placeholder={`Reply to ${c.user?.f_name || 'User'}...`}
                        style={styles.replyInput}
                        multiline
                        maxLength={500}
                      />
                      <TouchableOpacity
                        disabled={!replyText.trim() || submittingReply}
                        onPress={() => handleReplySubmit(c.comment_id)}
                        style={[
                          styles.replySendButton,
                          (!replyText.trim() || submittingReply) && { opacity: 0.5 }
                        ]}
                      >
                        {submittingReply ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Ionicons name="send" size={18} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Replies list */}
                {(() => {
                  const shouldShow = showReplies[c.comment_id];
                  const hasReplies = commentReplies[c.comment_id];
                  console.log(`Comment ${c.comment_id} - shouldShow: ${shouldShow}, hasReplies: ${!!hasReplies}, repliesCount: ${hasReplies?.length || 0}`);
                  return shouldShow && hasReplies;
                })() && (
                  <View style={styles.repliesContainer}>
                    {commentReplies[c.comment_id].map((reply, replyIndex) => {
                      const isMyReply = reply.user?.user_id === meId;
                      const isEditingReply = editingReplyId === reply.reply_id;
                      
                      return (
                        <View key={replyIndex} style={styles.replyItem}>
                          <Image source={renderAvatar(reply.user?.profile_pic)} style={styles.replyAvatar} />
                          <View style={styles.replyContent}>
                            <TouchableOpacity 
                              onPress={() => {
                                if (reply.user?.user_id && reply.user.user_id !== meId) {
                                  router.push(`/otheruser/otheruser?userId=${reply.user.user_id}`);
                                }
                              }}
                              disabled={!reply.user?.user_id || reply.user.user_id === meId}
                            >
                              <Text style={[
                                styles.replyName,
                                (reply.user?.user_id && reply.user.user_id !== meId) ? styles.clickableName : null
                              ]}>
                                {`${reply.user?.f_name || ''} ${reply.user?.l_name || ''}`.trim() || 'User'}
                              </Text>
                            </TouchableOpacity>
                            
                            {isEditingReply ? (
                              <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                style={styles.editReplyContainer}
                              >
                                <TextInput
                                  style={styles.editReplyInput}
                                  value={editReplyText}
                                  onChangeText={setEditReplyText}
                                  placeholder="Edit your reply..."
                                  placeholderTextColor="#9ca3af"
                                  multiline
                                  autoFocus
                                  returnKeyType="default"
                                  blurOnSubmit={false}
                                />
                                <View style={styles.editReplyActions}>
                                  <TouchableOpacity
                                    style={styles.editReplyButton}
                                    onPress={() => handleReplyUpdate(c.comment_id, reply.reply_id)}
                                  >
                                    <Text style={styles.editReplyButtonText}>Update</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.cancelReplyButton}
                                    onPress={() => setEditingReplyId(null)}
                                  >
                                    <Text style={styles.cancelReplyButtonText}>Cancel</Text>
                                  </TouchableOpacity>
                                </View>
                              </KeyboardAvoidingView>
                            ) : (
                              <Text style={styles.replyText}>
                                {renderTextWithMentions(reply.reply_content, [], (userId) => {
                                  router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                                })}
                              </Text>
                            )}
                            
                            <Text style={styles.replyTime}>{dayjs(reply.date_created).fromNow()}</Text>
                            
                            {/* Reply Actions */}
                            {isMyReply && !isEditingReply && (
                              <View style={styles.replyActions}>
                                <TouchableOpacity
                                  style={styles.replyActionButton}
                                  onPress={() => {
                                    setEditingReplyId(reply.reply_id);
                                    setEditReplyText(reply.reply_content);
                                  }}
                                >
                                  <Text style={styles.replyActionText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.replyActionButton}
                                  onPress={() => {
                                    Alert.alert(
                                      'Delete Reply',
                                      'Are you sure you want to delete this reply?',
                                      [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                          text: 'Delete',
                                          style: 'destructive',
                                          onPress: () => handleReplyDelete(c.comment_id, reply.reply_id)
                                        }
                                      ]
                                    );
                                  }}
                                >
                                  <Text style={[styles.replyActionText, styles.replyDeleteText]}>Delete</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Top bar */}
      <View style={[styles.topBar, { height: 48 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{headerTitle}</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.divider} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Comments list */}
        <FlatList
          data={comments}
          keyExtractor={(c) => String(c.comment_id)}
          renderItem={renderComment}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingBottom: hideComposer ? insets.bottom + 12 : insets.bottom + 12,
          }}
          ListHeaderComponent={
            post ? (
              <View style={styles.postCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <UserAvatar 
                    profilePic={post.user?.profile_pic}
                    firstName={post.user?.f_name}
                    lastName={post.user?.l_name}
                    size={40}
                    style={styles.avatar}
                  />
                  <View>
                    <Text style={styles.name}>
                      {`${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User'}
                    </Text>
                    {!!post.created_at && (
                      <Text style={styles.subtle}>{dayjs(post.created_at).fromNow()}</Text>
                    )}
                  </View>
                </View>
                {!!post.post_title && <Text style={styles.postTitle}>{post.post_title}</Text>}
                {!!post.post_content && (
                  <Text style={styles.postContent}>{post.post_content}</Text>
                )}
                {/* Images - support multiple images */}
                {(() => {
                  const images: any[] = [];
                  
                  // Add main post image if exists (backward compatibility)
                  if (post.post_image) {
                    console.log('Comments - Adding post_image:', post.post_image);
                    images.push({
                      image_id: 0,
                      image_url: post.post_image,
                      order: 0
                    });
                  }
                  
                  // Add post_images array if exists (multiple images)
                  if (post.post_images && Array.isArray(post.post_images)) {
                    console.log('Comments - Adding post_images:', post.post_images);
                    images.push(...post.post_images);
                  }
                  
                  console.log('Comments - Images to display:', images);
                  console.log('Comments - Images length:', images.length);
                  console.log('Comments - Will render images:', images.length > 0);
                  return images.length > 0 && (
                    <View style={styles.imagesContainer}>
                      {images.length === 1 ? (
                        <TouchableOpacity 
                          onPress={() => {
                            setSelectedImageIndex(0);
                            setImageViewerVisible(true);
                          }}
                          style={styles.imageWrapper}
                        >
                          <Image
                            source={renderAvatar(images[0].image_url)}
                            style={styles.postImage}
                            resizeMode="cover"
                            onError={(error) => {
                              console.log('Comments - Image load error:', error.nativeEvent.error);
                              console.log('Comments - Failed image URL:', images[0].image_url);
                            }}
                            onLoad={() => {
                              console.log('Comments - Image loaded successfully:', images[0].image_url);
                            }}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={[
                          styles.imagesGrid,
                          images.length === 2 && styles.twoImagesGrid,
                          images.length === 3 && styles.threeImagesGrid,
                          images.length === 4 && styles.fourImagesGrid,
                          images.length >= 5 && styles.fivePlusImagesGrid
                        ]}>
                          {images.slice(0, 6).map((image, index) => (
                            <TouchableOpacity 
                              key={index}
                              onPress={() => {
                                setSelectedImageIndex(index);
                                setImageViewerVisible(true);
                              }}
                              style={[
                                styles.gridImageContainer,
                                images.length === 3 && index === 0 && styles.threeImagesFirst,
                                images.length === 3 && index > 0 && styles.threeImagesRest
                              ]}
                            >
                              <Image
                                source={renderAvatar(image.image_url)}
                                style={styles.gridImage}
                                resizeMode="cover"
                                onError={(error) => {
                                  console.log('Comments - Image load error:', error.nativeEvent.error);
                                  console.log('Comments - Failed image URL:', image.image_url);
                                }}
                                onLoad={() => {
                                  console.log('Comments - Image loaded successfully:', image.image_url);
                                }}
                              />
                              {/* Show "+X more" overlay for the 6th image if there are more than 6 */}
                              {index === 5 && images.length > 6 && (
                                <View style={styles.moreImagesOverlay}>
                                  <Text style={styles.moreImagesText}>+{images.length - 6}</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}
                <Text style={styles.sectionTitle}>Comments</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ padding: 20 }}>
              <Text style={styles.subtle}>No comments yet</Text>
            </View>
          }
        />

        {/* Composer */}
        {!hideComposer && (
          <View
            style={[
              styles.composerWrap,
              {
                paddingBottom: Math.max(8, insets.bottom),
              },
            ]}
          >
            <View style={styles.composerInputRow}>
              <MentionInput
                value={commentText}
                onChange={setCommentText}
                placeholder="Write a comment…"
                style={[styles.inputText, { minHeight: 44, maxHeight: 120, height: composerHeight }]}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                disabled={!canSend}
                onPress={handleSend}
                style={[styles.sendBtn, !canSend && { opacity: 0.5 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Popup Modal */}
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
                      onPress: () => handleDelete(actionFor.comment_id),
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

      {/* Image Viewer Modal */}
      {imageViewerVisible && post && (() => {
        const images: any[] = [];
        if (post.post_image) images.push({ image_url: post.post_image, order: 0 });
        if (Array.isArray(post.post_images)) images.push(...post.post_images);
        const sortedImages = images.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
        return sortedImages.length > 0 && (
          <Modal visible={imageViewerVisible} transparent animationType="fade">
            <View style={styles.imageViewerOverlay}>
              <TouchableOpacity 
                style={styles.imageViewerContainer}
                onPress={() => setImageViewerVisible(false)}
              >
                <View style={styles.imageViewerHeader}>
                  <TouchableOpacity
                    onPress={() => setImageViewerVisible(false)}
                    style={styles.imageViewerCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                  {sortedImages.length > 1 && (
                    <Text style={styles.imageViewerPagination}>
                      {selectedImageIndex + 1} of {sortedImages.length}
                    </Text>
                  )}
                </View>
                <ScrollView 
                  horizontal 
                  pagingEnabled 
                  showsHorizontalScrollIndicator={false}
                  style={styles.imageViewerScroll}
                  contentOffset={{ x: selectedImageIndex * 400, y: 0 }}
                >
                  {sortedImages.map((image, index) => (
                    <View key={index} style={styles.imageViewerItem}>
                      <Image 
                        source={renderAvatar(image.image_url)} 
                        style={styles.imageViewerImage}
                        resizeMode="contain"
                      />
                    </View>
                  ))}
                </ScrollView>
              </TouchableOpacity>
            </View>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtle: {
    color: '#6b7280',
    fontSize: 12,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  backText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },

  // Post preview card
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  name: { fontSize: 14, fontWeight: '700', color: '#111827' },
  postTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  postContent: { color: '#111827' },
  postImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },

  // Comment row
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  cAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  cHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cName: { fontWeight: '600', color: '#111827' },
  cMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  bubble: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  highlightedBubble: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cBody: { color: '#111827' },

  // Edit state
  editBox: { marginTop: 6 },
  editInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    color: '#111827',
    minHeight: 40,
  },
  editActions: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
    justifyContent: 'flex-end',
  },

  // Composer
  composerWrap: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  composerInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputText: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    color: '#111827',
  },
  sendBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },

  // Bottom sheet
  sheetOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  actionSheetTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
    marginBottom: 8,
  },
  sheetButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    marginVertical: 6,
  },
  sheetButtonText: { fontSize: 15, color: '#1e3a8a', fontWeight: '600' },
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupBox: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  popupTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  popupButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    marginVertical: 6,
    alignItems: 'center',
  },
  popupButtonText: {
    fontSize: 15,
    color: '#1e3a8a',
    fontWeight: '600',
  },
  imagesContainer: {
    marginTop: 10,
  },
  imagesScrollContainer: {
    paddingRight: 10,
  },
  
  // Reply styles
  replySection: {
    marginTop: 8,
    marginLeft: 40,
  },
  replyButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  replyButtonText: { color: '#1d4ed8', fontWeight: '600' },
  repliesToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 6,
  },
  repliesToggleText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  replyInputContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  replyInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  replyCancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  replyCancelText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  replySubmitButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#1e3a8a',
  },
  replySubmitButtonDisabled: {
    opacity: 0.5,
  },
  replySubmitText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: 36,
    gap: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
    paddingLeft: 10,
  },
  replyItem: {
    flexDirection: 'row',
    gap: 8,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  replyContent: {
    flex: 1,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  replyTime: {
    fontSize: 10,
    color: '#6b7280',
  },
  replyBubble: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  replyText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
  },
  replyEditContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  replyEditInput: {
    fontSize: 13,
    minHeight: 40,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  replyEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  replyEditSave: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#1e3a8a',
  },
  replyEditSaveText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  replyEditCancel: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  replyEditCancelText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  replyActionButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
  },
  replyActionText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  replyDeleteText: {
    color: '#dc2626',
  },
  clickableName: {
    color: '#1e3a8a',
  },
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyingToText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  replySendButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editReplyContainer: {
    marginTop: 8,
  },
  editReplyInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    minHeight: 40,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  editReplyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  editReplyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#1e3a8a',
  },
  editReplyButtonText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  cancelReplyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  cancelReplyButtonText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  imageWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  imageViewerCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageViewerPagination: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  imageViewerScroll: {
    flex: 1,
    width: '100%',
  },
  imageViewerItem: {
    width: 400,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  
  // Grid Layout Styles
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  twoImagesGrid: {
    height: 200,
  },
  threeImagesGrid: {
    height: 200,
  },
  fourImagesGrid: {
    height: 200,
  },
  fivePlusImagesGrid: {
    height: 200,
  },
  gridImageContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  threeImagesFirst: {
    width: '50%',
    height: '100%',
  },
  threeImagesRest: {
    width: '50%',
    height: '50%',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    minHeight: 100,
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

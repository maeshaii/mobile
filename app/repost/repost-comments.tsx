import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Modal, FlatList, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';

import { FontAwesome, Ionicons } from '@expo/vector-icons';

import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL, getRepostComments, commentOnRepost, updateRepostComment, deleteRepostComment, getRepostDetail, getUserInfo, updateRepost, deleteRepost, getPostLikes, getCommentReplies, createCommentReply, updateCommentReply, deleteCommentReply } from '../../services/api';

import UserAvatar from '../../components/UserAvatar';

import CachedImage from '../../components/CachedImage';

import MentionInput from '../../components/MentionInput';

import { renderTextWithMentions } from '../../utils/mentionUtils';

import { getImagesFromContent } from '../../utils/imageUtils';

import dayjs from 'dayjs';

import relativeTime from 'dayjs/plugin/relativeTime';



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



export default function RepostCommentsScreen() {

  const router = useRouter();

  const { repostId, highlightCommentId } = useLocalSearchParams();

  const insets = useSafeAreaInsets();

  

  console.log('RepostCommentsScreen - repostId from params:', repostId);

  

  const [comments, setComments] = useState<CommentItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [commentText, setCommentText] = useState('');

  const [inputHeight, setInputHeight] = useState(44);

  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [editText, setEditText] = useState('');

  const [repost, setRepost] = useState<any>(null);

  const [me, setMe] = useState<any>(null);

  const [actionFor, setActionFor] = useState<CommentItem | null>(null);

  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);

  const [originalImages, setOriginalImages] = useState<any[]>([]);



  // Reply state management

  const [commentReplies, setCommentReplies] = useState<{ [commentId: number]: ReplyItem[] }>({});

  const [showReplies, setShowReplies] = useState<{ [commentId: number]: boolean }>({});

  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const [replyText, setReplyText] = useState('');

  const [submittingReply, setSubmittingReply] = useState(false);

  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);

  const [editReplyText, setEditReplyText] = useState('');



  const [now, setNow] = useState(dayjs());

  useEffect(() => {

    const t = setInterval(() => setNow(dayjs()), 60000);

    return () => clearInterval(t);

  }, []);






  // Load replies for comments that have replies when comments change

  useEffect(() => {

    if (comments.length > 0) {

      console.log('Comments loaded, checking for replies...');

      comments.forEach(comment => {

        console.log(`Comment ${comment.comment_id} has ${comment.replies_count || 0} replies`);

        if ((comment.replies_count || 0) > 0) {

          console.log(`Loading replies for comment ${comment.comment_id}`);

          loadReplies(comment.comment_id);

          // Automatically show replies when they exist

          setShowReplies(prev => {

            const newState = { ...prev, [comment.comment_id]: true };

            console.log('Setting showReplies to:', newState);

            return newState;

          });

        }

      });

    }

  }, [comments]);



  const load = useCallback(async () => {

    if (!repostId) {

      console.error('No repostId provided');

      setLoading(false);

      return;

    }



    try {

      setLoading(true);

      console.log('Loading repost and comments for repostId:', repostId);

      

      const [repostData, commentsData, user] = await Promise.all([

        getRepostDetail(Number(repostId)),

        getRepostComments(Number(repostId)),

        getUserInfo()

      ]);

      

      console.log('Repost detail data:', repostData);

      console.log('Comments data:', commentsData);

      console.log('User data:', user);

      console.log('Original post data:', repostData?.original);

      console.log('Original post images:', repostData?.original?.post_image);

      console.log('Original post images array:', repostData?.original?.post_images);

      

      setMe(user);

      setRepost(repostData);

      

      // Handle comments data with better error checking

      const commentsArray = Array.isArray(commentsData?.comments) ? commentsData.comments : [];

      console.log('Setting comments:', commentsArray.length);

      setComments(commentsArray);

      

      // Extract original post images using centralized utility with deduplication
      const originalContent = repostData?.original || (repostData as any)?.original_post;
      const extractedImages = originalContent ? getImagesFromContent(originalContent) : [];

      console.log('Extracted images:', extractedImages);

      setOriginalImages(extractedImages);

      

      // Highlight specific comment if provided

      if (highlightCommentId && commentsArray.length > 0) {

        const commentExists = commentsArray.some((c: CommentItem) => c.comment_id === Number(highlightCommentId));

        if (commentExists) {

          setHighlightedCommentId(Number(highlightCommentId));

          // Remove highlight after 3 seconds

          setTimeout(() => {

            setHighlightedCommentId(null);

          }, 3000);

        }

      }

    } catch (error: any) {

      console.error('Error loading repost and comments:', error);

      

      // Handle specific error cases

      if (error?.response?.status === 404) {

        Alert.alert('Error', 'Repost not found. It may have been deleted.');

      } else if (error?.response?.status === 500) {

        Alert.alert('Error', 'Server error. Please try again later.');

      } else {

        Alert.alert('Error', `Failed to load repost and comments: ${error?.message || 'Unknown error'}`);

      }

      

      // Set empty state

      setComments([]);

      setRepost(null);

    } finally {

      setLoading(false);

    }

  }, [repostId, highlightCommentId]);



  useEffect(() => {

    if (repostId) load();

  }, [repostId, load]);

  // Refresh when screen regains focus
  useFocusEffect(
    useCallback(() => {
      if (repostId) {
        load();
      }
    }, [repostId, load])
  );



  const onRefresh = useCallback(async () => {

    try {

      setRefreshing(true);

      const commentsData = await getRepostComments(Number(repostId));

      setComments(Array.isArray(commentsData?.comments) ? commentsData.comments : []);

    } finally {

      setRefreshing(false);

    }

  }, [repostId]);



  const renderAvatar = (src?: string | null) => {

    if (!src) return require('../../assets/images/sample_pic.jpg');

    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');

    const imageUrl = isAbs ? src : `${API_BASE_URL}${src}`;

    return { uri: imageUrl };

  };



  const renderPostImage = (src?: string | null) => {

    if (!src) {

      console.log('Repost Comments - renderPostImage - no src provided');

      return null;

    }

    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');

    let imageUrl = isAbs ? src : `${API_BASE_URL}${src}`;
    try {
      const url = new URL(imageUrl);
      if (/ngrok/i.test(url.hostname) && !url.searchParams.has('ngrok-skip-browser-warning')) {
        url.searchParams.set('ngrok-skip-browser-warning', 'true');
        imageUrl = url.toString();
      }
    } catch {}

    console.log('Repost Comments - renderPostImage - src:', src, 'isAbs:', isAbs, 'imageUrl:', imageUrl);

    return { uri: imageUrl };

  };



  const meId = me?.id || me?.user_id;

  const canSend = !!repostId && !!commentText.trim() && !submitting;



  async function handleSend() {

    if (!canSend) return;

    

    try {

      setSubmitting(true);

      console.log('Submitting comment for repostId:', repostId, 'text:', commentText.trim());

      

      const response = await commentOnRepost(Number(repostId), commentText.trim());

      console.log('Comment submission response:', response);

      

      setCommentText('');

      setInputHeight(44);

      await onRefresh();

      

      // Show success feedback

      Alert.alert('Success', 'Comment added successfully');

    } catch (err: any) {

      console.error('[repost comments] send failed', err);

      

      // Handle specific error cases

      if (err?.response?.status === 400) {

        Alert.alert('Error', 'Invalid comment. Please check your input.');

      } else if (err?.response?.status === 404) {

        Alert.alert('Error', 'Repost not found. It may have been deleted.');

      } else if (err?.response?.status === 500) {

        Alert.alert('Error', 'Server error. Please try again later.');

      } else {

        Alert.alert('Error', 'Failed to add comment. Please try again.');

      }

    } finally {

      setSubmitting(false);

    }

  }



  async function handleUpdate(commentId: number) {

    if (!editText.trim()) return;

    

    try {

      console.log('Updating comment:', commentId, 'text:', editText.trim());

      await updateRepostComment(Number(repostId), commentId, editText.trim());

      setEditingId(null);

      setEditText('');

      await onRefresh();

      Alert.alert('Success', 'Comment updated successfully');

    } catch (err: any) {

      console.error('[repost comments] update failed', err);

      

      // Handle specific error cases

      if (err?.response?.status === 400) {

        Alert.alert('Error', 'Invalid comment. Please check your input.');

      } else if (err?.response?.status === 404) {

        Alert.alert('Error', 'Comment not found. It may have been deleted.');

      } else if (err?.response?.status === 403) {

        Alert.alert('Error', 'You can only edit your own comments.');

      } else {

        Alert.alert('Error', 'Failed to update comment. Please try again.');

      }

    }

  }



  async function handleDelete(commentId: number) {

    try {

      console.log('Deleting comment:', commentId);

      await deleteRepostComment(Number(repostId), commentId);

      await onRefresh();

      Alert.alert('Success', 'Comment deleted successfully');

    } catch (err: any) {

      console.error('[repost comments] delete failed', err);

      

      // Handle specific error cases

      if (err?.response?.status === 404) {

        Alert.alert('Error', 'Comment not found. It may have been deleted.');

      } else if (err?.response?.status === 403) {

        Alert.alert('Error', 'You can only delete your own comments.');

      } else {

        Alert.alert('Error', 'Failed to delete comment. Please try again.');

      }

    }

  }



  // Reply functions

  async function loadReplies(commentId: number) {

    try {

      console.log('=== LOADING REPLIES ===');

      console.log('Loading replies for comment:', commentId);

      const response = await getCommentReplies(commentId);

      console.log('Replies response:', response);

      console.log('Number of replies received:', response.replies?.length || 0);

      console.log('Replies data:', response.replies);

      

      setCommentReplies(prev => {

        const newReplies = { ...prev, [commentId]: response.replies || [] };

        console.log('Updated commentReplies state:', newReplies);

        console.log('Replies for comment', commentId, ':', newReplies[commentId]);

        console.log('=== REPLIES LOADED ===');

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



  const hideComposer = !!actionFor || editingId !== null || replyingTo !== null || editingReplyId !== null;

  

  // Debug logging

  console.log('hideComposer:', hideComposer, 'actionFor:', !!actionFor, 'editingId:', editingId);

  const composerHeight = Math.min(Math.max(inputHeight || 44, 44), 120);





  const commentCount = comments.length;

  const headerTitle = useMemo(() => `Comments · ${commentCount}`, [commentCount]);



  const renderComment = ({ item: c }: { item: CommentItem }) => {

    const isMine = c.user.user_id === meId;

    const isRepostOwner = repost?.user?.user_id === meId || repost?.user?.id === meId;

    const canManage = isMine || isRepostOwner;

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

                <TouchableOpacity 

                  onPress={() => {

                    if (c.user?.user_id && c.user.user_id !== meId) {

                      router.push(`/otheruser/otheruser?userId=${c.user.user_id}`);

                    }

                  }}

                  disabled={!c.user?.user_id || c.user.user_id === meId}

                >

                  <Text style={[

                    styles.cName,

                    (c.user?.user_id && c.user.user_id !== meId) ? styles.clickableName : null

                  ]}>

                    {`${c.user?.f_name || ''} ${c.user?.l_name || ''}`.trim() || 'User'}

                  </Text>

                </TouchableOpacity>

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

                <MentionInput

                  value={editText}

                  onChange={setEditText}

                  placeholder="Edit your comment..."

                  style={styles.editInput}

                  multiline

                  maxLength={500}

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



                {/* Show/Hide replies toggle (always visible) */}
                <TouchableOpacity 
                  style={styles.repliesToggle}
                  onPress={() => toggleReplies(c.comment_id)}
                >
                  <Text style={styles.repliesToggleText}>
                    {(() => {
                      const loadedCount = Array.isArray(commentReplies[c.comment_id]) ? commentReplies[c.comment_id].length : null;
                      const count = loadedCount !== null ? loadedCount : (c.replies_count || 0);
                      const label = showReplies[c.comment_id] ? 'Hide' : 'View';
                      const noun = count === 1 ? 'reply' : 'replies';
                      return `${label} ${count} ${noun}`;
                    })()}
                  </Text>
                </TouchableOpacity>



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

                  console.log(`=== REPLY DISPLAY CHECK ===`);

                  console.log(`Comment ${c.comment_id} - shouldShow: ${shouldShow}`);

                  console.log(`Comment ${c.comment_id} - hasReplies: ${!!hasReplies}`);

                  console.log(`Comment ${c.comment_id} - repliesCount: ${hasReplies?.length || 0}`);

                  console.log(`Comment ${c.comment_id} - showReplies state:`, showReplies);

                  console.log(`Comment ${c.comment_id} - commentReplies state:`, commentReplies);

                  console.log(`Comment ${c.comment_id} - Will display: ${shouldShow && hasReplies}`);

                  console.log(`=== END REPLY DISPLAY CHECK ===`);

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

                                <MentionInput

                                  value={editReplyText}

                                  onChange={setEditReplyText}

                                  placeholder="Edit your reply..."

                                  style={styles.editReplyInput}

                                  multiline

                                  maxLength={500}

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

                              renderTextWithMentions(reply.reply_content, [], (userId) => {
                                router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                              })

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



  if (!repostId) {

    return (

      <View style={styles.center}>

        <Text style={styles.title}>Invalid repost</Text>

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

        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}

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

            paddingBottom: hideComposer ? insets.bottom + 12 : insets.bottom + 80,

          }}

          ListHeaderComponent={

            repost ? (

              <View style={styles.postCard}>

                {/* Repost Header */}

          <View style={styles.repostHeader}>

            <UserAvatar 

              profilePic={repost.user?.profile_pic}

              firstName={repost.user?.f_name}

              lastName={repost.user?.l_name}

                    size={40}

                    style={styles.avatar}

            />

                  <View style={{ flex: 1 }}>

                    <Text style={styles.name}>

                      {`${repost.user?.f_name || ''} ${repost.user?.l_name || ''}`.trim() || 'User'}

                    </Text>

                    {!!repost.repost_date && (

                      <Text style={styles.subtle}>{dayjs(repost.repost_date).fromNow()}</Text>

                    )}

                  </View>

                  {repost.user?.user_id === meId && (

                    <TouchableOpacity 

                      onPress={() => {

                        Alert.alert('Repost Options', 'What would you like to do?', [

                          { 

                            text: 'Edit Caption', 

                            onPress: () => {

                              Alert.prompt(

                                'Edit Caption',

                                'Enter new caption:',

                                [

                                  { text: 'Cancel', style: 'cancel' },

                                  { 

                                    text: 'Save', 

                                    onPress: async (newCaption?: string) => {

                                      if (newCaption !== null && newCaption !== undefined && newCaption.trim()) {

                                        try {

                                          console.log('Updating repost caption:', newCaption);

                                          await updateRepost(repost.repost_id, newCaption.trim());

                                          

                                          // Update local repost data

                                          setRepost((prev: any) => ({

                                            ...prev,

                                            caption: newCaption.trim()

                                          }));

                                          

                                          Alert.alert('Success', 'Caption updated successfully!');

                                        } catch (error) {

                                          console.error('Error updating repost caption:', error);

                                          Alert.alert('Error', 'Failed to update caption. Please try again.');

                                        }

                                      }

                                    }

                                  }

                                ],

                                'plain-text',

                                repost.caption || ''

                              );

                            }

                          },

                          { 

                            text: 'Delete Repost', 

                            style: 'destructive',

                            onPress: () => {

                              Alert.alert(

                                'Delete Repost',

                                'Are you sure you want to delete this repost? This action cannot be undone.',

                                [

                                  { text: 'Cancel', style: 'cancel' },

                                  { 

                                    text: 'Delete', 

                                    style: 'destructive',

                                    onPress: async () => {

                                      try {

                                        console.log('Deleting repost:', repost.repost_id);

                                        await deleteRepost(repost.repost_id);

                                        Alert.alert('Success', 'Repost deleted successfully!');

                                        router.back();

                                      } catch (error) {

                                        console.error('Error deleting repost:', error);

                                        Alert.alert('Error', 'Failed to delete repost. Please try again.');

                                      }

                                    }

                                  }

                                ]

                              );

                            }

                          },

                          { text: 'Cancel', style: 'cancel' }

                        ]);

                      }}

                      style={{ padding: 4 }}

                    >

                      <Ionicons name="ellipsis-horizontal" size={20} color="#6b7280" />

                    </TouchableOpacity>

                  )}

          </View>

          

                {repost.caption && repost.caption.trim() ? (

                  <Text style={styles.postContent}>{repost.caption}</Text>

                ) : null}



          {/* Original Post */}

          {(repost.original || (repost as any).original_post) && (

            <TouchableOpacity 

              style={styles.originalPostContainer}

              onPress={() => {
                // Handle navigation based on the type of original content
                const original = repost?.original || (repost as any)?.original_post;
                if (original?.post_id) {
                  console.log('Navigating to original post detail:', original.post_id);
                  router.push(`/posts/detail?postId=${original.post_id}`);
                } else if (original?.forum_id) {
                  console.log('Navigating to original forum detail:', original.forum_id);
                  router.push(`/posts/detail?postId=${original.forum_id}`);
                } else if (original?.donation_id) {
                  console.log('Navigating to original donation detail:', original.donation_id);
                  router.push(`/posts/detail?postId=${original.donation_id}`);
                }
              }}

            >

              <View style={styles.originalHeader}>

                <UserAvatar 

                  profilePic={(repost?.original || (repost as any)?.original_post)?.user?.profile_pic}

                  firstName={(repost?.original || (repost as any)?.original_post)?.user?.f_name}

                  lastName={(repost?.original || (repost as any)?.original_post)?.user?.l_name}

                  size={40}

                  style={styles.avatar}

                />

                <View style={{ flex: 1 }}>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                    <Text style={styles.name}>

                      {`${(repost?.original || (repost as any)?.original_post)?.user?.f_name || ''} ${(repost?.original || (repost as any)?.original_post)?.user?.l_name || ''}`.trim() || 'User'}

                    </Text>

                    {meId === (repost?.original || (repost as any)?.original_post)?.user?.user_id && (

                      <View style={{ 

                        backgroundColor: '#e3f2fd', 

                        paddingHorizontal: 6, 

                        paddingVertical: 2, 

                        borderRadius: 10 

                      }}>

                        <Text style={{ fontSize: 10, color: '#1976d2', fontWeight: '500' }}>

                          YOUR POST

                        </Text>

                      </View>

                    )}

                  </View>

                  {(repost?.original || (repost as any)?.original_post)?.created_at && (

                    <Text style={styles.subtle}>{dayjs((repost?.original || (repost as any)?.original_post)?.created_at).fromNow()}</Text>

                  )}

                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                  <Ionicons name="chevron-forward" size={16} color="#6b7280" />

                </View>

              </View>

              {(() => {
                const original = repost?.original || (repost as any)?.original_post;
                const content = (original?.content && original.content.trim()) || (original?.post_content && original.post_content.trim());
                return content ? (
                  <Text style={styles.postContent}>{original?.content || original?.post_content}</Text>
                ) : (
                  <Text style={[styles.postContent, { fontStyle: 'italic', color: '#6b7280' }]}>
                    Original post content unavailable
                  </Text>
                );
              })()}

              

              {/* Original Post Image */}
              {(repost.original || (repost as any).original_post) && (
                <View style={styles.originalPostImageContainer}>
                  {(() => {
                    console.log('Rendering images - originalImages.length:', originalImages.length);
                    console.log('Rendering images - originalImages:', originalImages);
                  const original = repost?.original || (repost as any)?.original_post;
                  console.log('Rendering images - original:', original);
                  console.log('Rendering images - original.post_image:', original?.post_image);
                  console.log('Rendering images - original.post_images:', original?.post_images);
                  console.log('Rendering images - original.images:', original?.images);
                    return null;
                  })()}

                  {(() => {
                    // Use originalImages state, with fallback to direct extraction if empty
                    const original = repost?.original || (repost as any)?.original_post;
                    const imagesToRender = originalImages.length > 0 
                      ? originalImages 
                      : original ? getImagesFromContent(original) : [];
                    
                    console.log('Rendering images - imagesToRender.length:', imagesToRender.length);
                    console.log('Rendering images - imagesToRender:', imagesToRender);
                    console.log('Rendering images - Will show images?', imagesToRender.length > 0);
                    
                    return imagesToRender;
                  })().length > 0 ? (

                    (() => {

                      const original = repost?.original || (repost as any)?.original_post;
                      const imagesToRender = originalImages.length > 0 

                        ? originalImages 

                        : original ? getImagesFromContent(original) : [];

                      

                      return imagesToRender.length === 1 ? (

                        <TouchableOpacity 

                          onPress={() => {

                            setSelectedImageIndex(0);

                            setImageViewerVisible(true);

                          }}

                          style={styles.originalPostImageWrapper}

                        >

                          <CachedImage 

                            uri={String(imagesToRender[0].image_url).startsWith('http') ? imagesToRender[0].image_url : `${API_BASE_URL}${imagesToRender[0].image_url}`} 

                            style={styles.originalPostImage} 

                            contentFit="cover" 

                          />

                        </TouchableOpacity>

                      ) : (

                        <View style={[

                          styles.originalPostImagesGrid,

                          imagesToRender.length === 2 && styles.originalTwoImagesGrid,

                          imagesToRender.length === 3 && styles.originalThreeImagesGrid,

                          imagesToRender.length === 4 && styles.originalFourImagesGrid,

                          imagesToRender.length >= 5 && styles.originalFivePlusImagesGrid

                        ]}>

                          {imagesToRender.slice(0, 6).map((image, index) => (

                            <TouchableOpacity 

                              key={index}

                              onPress={() => {

                                setSelectedImageIndex(index);

                                setImageViewerVisible(true);

                              }}

                              style={[

                                styles.originalGridImageContainer,

                                imagesToRender.length === 3 && index === 0 && styles.originalThreeImagesFirst,

                                imagesToRender.length === 3 && index > 0 && styles.originalThreeImagesRest

                              ]}

                            >

                              <CachedImage 

                                uri={String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}`} 

                                style={styles.originalGridImage} 

                                contentFit="cover" 

                              />

                              {/* Show "+X more" overlay for the 6th image if there are more than 6 */}

                              {index === 5 && imagesToRender.length > 6 && (

                                <View style={styles.originalMoreImagesOverlay}>

                                  <Text style={styles.originalMoreImagesText}>+{imagesToRender.length - 6}</Text>

                                </View>

                              )}

                            </TouchableOpacity>

                          ))}

                        </View>

                      );

                    })()

                  ) : (

                    <View style={styles.noImageContainer}>

                      <Text style={styles.noImageText}>No image attached</Text>

                    </View>

                  )}

                </View>

              )}

            </TouchableOpacity>

          )}

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

                position: 'relative',

                zIndex: 1,

              },

            ]}

          >

            <View style={styles.composerInputRow}>

                    <MentionInput

                value={commentText}

                onChange={setCommentText}

                placeholder={replyingTo ? "Replying to comment..." : "Write a comment…"}

                style={[styles.inputText, { minHeight: 44, maxHeight: 120, height: composerHeight }, (replyingTo || editingReplyId) ? styles.disabledInput : null]}

                multiline

                maxLength={500}

                disabled={!!replyingTo || !!editingReplyId}

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

            {actionFor?.user?.user_id === meId && (

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

                      

            {/* Delete: show if comment is mine OR I am the repost owner */}

            {(actionFor?.user?.user_id === meId || repost?.user?.user_id === meId || repost?.user?.id === meId) && (

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

                        onPress: () => {

                          handleDelete(actionFor.comment_id);

                          setActionFor(null);

                        },

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

      {imageViewerVisible && originalImages.length > 0 && (

        <View style={styles.imageViewerOverlay}>

          <TouchableOpacity 

            style={styles.imageViewerCloseButton}

            onPress={() => setImageViewerVisible(false)}

          >

            <Text style={styles.imageViewerCloseText}>✕</Text>

          </TouchableOpacity>

          <View style={styles.imageViewerContainer}>

            {originalImages.length > 1 && (

              <View style={styles.imageViewerCounter}>

                <Text style={styles.imageViewerCounterText}>

                  {selectedImageIndex + 1} of {originalImages.length}

                </Text>

              </View>

            )}

            <ScrollView 

              horizontal 

              pagingEnabled 

              showsHorizontalScrollIndicator={false}

              onMomentumScrollEnd={(event) => {

                const index = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);

                setSelectedImageIndex(index);

              }}

            >

              {originalImages.map((image, index) => {

                const imageSource = renderPostImage(image.image_url);

                if (!imageSource) return null;

                return (

                  <Image

                    key={index}

                    source={imageSource}

                    style={styles.imageViewerImage}

                    resizeMode="contain"

                  />

                );

              })}

            </ScrollView>

          </View>

        </View>

      )}



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

  repostHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 8,

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

  originalPostContainer: {

    backgroundColor: '#f8f9fa',

    borderRadius: 12,

    padding: 12,

    borderWidth: 1,

    borderColor: '#e9ecef',

    marginTop: 8,

  },

  originalHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 8,

  },

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

    paddingVertical: 10,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: '#e5e7eb',

  },

  cAvatar: {

    width: 32,

    height: 32,

    borderRadius: 16,

    backgroundColor: '#e5e7eb',

  },

  cHeaderRow: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    gap: 8,

    marginBottom: 4,

  },

  cName: { fontWeight: '600', color: '#111827' },

  clickableName: { color: '#1e3a8a' },

  cMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  bubble: {

    backgroundColor: '#f3f4f6',

    borderRadius: 12,

    paddingHorizontal: 12,

    paddingVertical: 8,

    alignSelf: 'flex-start',

    maxWidth: '100%',

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

    shadowColor: '#000',

    shadowOffset: { width: 0, height: -2 },

    shadowOpacity: 0.1,

    shadowRadius: 4,

    elevation: 4,

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

  disabledInput: {

    backgroundColor: '#f3f4f6',

    color: '#9ca3af',

    borderColor: '#d1d5db',

  },

  sendBtn: {

    backgroundColor: '#1e3a8a',

    paddingHorizontal: 14,

    paddingVertical: 10,

    borderRadius: 10,

  },

  sendBtnText: { color: '#fff', fontWeight: '700' },



  // Popup Modal

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

  // Image Viewer Styles

  imageViewerOverlay: {

    position: 'absolute',

    top: 0,

    left: 0,

    right: 0,

    bottom: 0,

    backgroundColor: 'rgba(0,0,0,0.9)',

    justifyContent: 'center',

    alignItems: 'center',

    zIndex: 1000,

  },

  imageViewerCloseButton: {

    position: 'absolute',

    top: 60,

    right: 20,

    zIndex: 1001,

    backgroundColor: 'rgba(0,0,0,0.7)',

    borderRadius: 20,

    width: 40,

    height: 40,

    justifyContent: 'center',

    alignItems: 'center',

  },

  imageViewerCloseText: {

    color: '#fff',

    fontSize: 20,

    fontWeight: 'bold',

  },

  imageViewerContainer: {

    flex: 1,

    width: '100%',

    justifyContent: 'center',

    alignItems: 'center',

  },

  imageViewerCounter: {

    position: 'absolute',

    top: 50,

    left: 20,

    backgroundColor: 'rgba(0,0,0,0.5)',

    borderRadius: 15,

    paddingHorizontal: 12,

    paddingVertical: 6,

    zIndex: 1001,

  },

  imageViewerCounterText: {

    color: '#fff',

    fontSize: 14,

    fontWeight: 'bold',

  },

  imageViewerImage: {

    width: 400,

    height: 400,

  },

  // Original Post Image Styles

  originalPostImageContainer: {

    marginTop: 12,

    paddingHorizontal: 8,

  },

  originalPostImageWrapper: {

    borderRadius: 8,

    overflow: 'hidden',

    backgroundColor: '#f3f4f6',

  },

  originalPostImage: {

    width: '100%',

    height: 200,

    borderRadius: 8,

  },

  originalPostImagesScroll: {

    marginTop: 0,

  },

  originalPostImagesContent: {

    paddingRight: 8,

  },

  noImageContainer: {

    height: 120,

    backgroundColor: '#f9fafb',

    borderRadius: 8,

    justifyContent: 'center',

    alignItems: 'center',

    borderWidth: 1,

    borderColor: '#e5e7eb',

    borderStyle: 'dashed',

  },

  noImageText: {

    fontSize: 14,

    color: '#6b7280',

    fontStyle: 'italic',

  },

  

  // Reply styles

  replySection: {

    marginTop: 8,

    marginLeft: 40,

  },

  replyButton: {

    paddingVertical: 4,

    paddingHorizontal: 8,

    borderRadius: 4,

    backgroundColor: '#f3f4f6',

    alignSelf: 'flex-start',

    marginBottom: 8,

  },

  replyButtonText: {

    fontSize: 12,

    color: '#1e3a8a',

    fontWeight: '600',

  },

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

  replySendButton: {

    backgroundColor: '#1e3a8a',

    paddingHorizontal: 14,

    paddingVertical: 10,

    borderRadius: 10,

    justifyContent: 'center',

    alignItems: 'center',

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

    flex: 1,

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

  },

  replyItem: {

    flexDirection: 'row',

    marginBottom: 8,

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

    backgroundColor: '#f3f4f6',

    borderRadius: 8,

    padding: 8,

    maxWidth: '85%',

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

  

  // Original Post Grid Layout Styles

  originalPostImagesGrid: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 2,

  },

  originalTwoImagesGrid: {

    height: 200,

  },

  originalThreeImagesGrid: {

    height: 200,

  },

  originalFourImagesGrid: {

    height: 200,

  },

  originalFivePlusImagesGrid: {

    height: 200,

  },

  originalGridImageContainer: {

    position: 'relative',

    overflow: 'hidden',

  },

  originalThreeImagesFirst: {

    width: '50%',

    height: '100%',

  },

  originalThreeImagesRest: {

    width: '50%',

    height: '50%',

  },

  originalGridImage: {

    width: '100%',

    height: '100%',

    minHeight: 100,

  },

  originalMoreImagesOverlay: {

    position: 'absolute',

    top: 0,

    left: 0,

    right: 0,

    bottom: 0,

    backgroundColor: 'rgba(0, 0, 0, 0.75)',

    justifyContent: 'center',

    alignItems: 'center',

  },

  originalMoreImagesText: {

    color: 'white',

    fontSize: 20,

    fontWeight: 'bold',

  },

});
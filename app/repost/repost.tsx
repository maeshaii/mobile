import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { API_BASE_URL, getPostDetail, getUserInfo, repostPost, likePost, unlikePost, commentOnPost, updateRepost, deleteRepost, getPostComments, updateComment, deleteComment, getForumDetail, repostForumPost, likeForumPost, unlikeForumPost, commentOnForumPost, deleteForumRepost, getForumComments, updateForumComment, deleteForumComment, getRepostDetail } from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import UserAvatar from '../../components/UserAvatar';
import { getImagesFromContent } from '../../utils/imageUtils';
import { renderTextWithMentions } from '../../utils/mentionUtils';

dayjs.extend(relativeTime);

export default function RepostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = typeof params.postId === 'string' ? parseInt(params.postId) : undefined;
  const isForumPost = params.isForumPost === 'true';
  
  const [me, setMe] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caption, setCaption] = useState('');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'reposts' | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [myRepostId, setMyRepostId] = useState<number | null>(null); // Used by Mobile: existing repost id if already reposted
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [actionFor, setActionFor] = useState<any>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const u = await getUserInfo();
        setMe(u);
        
        if (!postId) {
          setLoading(false);
          return;
        }
        
        // First try to get as regular post/forum
        let detail = null;
        try {
          detail = isForumPost ? await getForumDetail(postId) : await getPostDetail(postId);
        } catch (error: any) {
          // If 404, it might be a repost ID - try to get repost detail and extract original post
          // This handles the case where someone accidentally passes a repost ID instead of a post ID
          if (error?.response?.status === 404) {
            try {
              console.log('RepostScreen - Post not found (404), checking if it\'s a repost ID:', postId);
              const repostData = await getRepostDetail(postId);
              
              // Check if we got valid repost data (not fallback)
              // Fallback data has repost_id: 0 or no original data
              if (repostData?.original && repostData.repost_id && repostData.repost_id !== 0 && repostData.repost_id === postId) {
                // Use the original post from the repost
                const original = repostData.original;
                
                // Get the original post ID based on type
                const originalPostId = original.post_id || original.forum_id || original.donation_id;
                
                // Check if we got valid original post data (not fallback)
                if (!originalPostId || originalPostId === 0) {
                  // This means getRepostDetail returned fallback data, which means the repost doesn't exist
                  // So the postId is not a repost ID, it's just a non-existent post ID
                  console.error('RepostScreen - Invalid repost data, original post ID is 0 or missing');
                  throw new Error('Post not found');
                }
                
                console.log('RepostScreen - Found repost, loading original post:', originalPostId, 'type:', original.type);
                
                // Now load the actual original post detail to get full data including reposts
                try {
                  if (original.type === 'forum') {
                    detail = await getForumDetail(originalPostId);
                  } else if (original.type === 'donation') {
                    const { getDonationDetail } = await import('../../services/api');
                    detail = await getDonationDetail(originalPostId);
                    // Normalize donation data
                    detail = {
                      ...detail,
                      post_id: detail.donation_id,
                      post_content: detail.description || detail.post_content || '',
                      post_title: detail.post_title || '',
                      post_image: detail.post_image || (detail.images?.[0]?.image_url || null),
                      post_images: detail.images || [],
                    };
                  } else {
                    detail = await getPostDetail(originalPostId);
                  }
                  console.log('RepostScreen - Successfully loaded original post detail');
                } catch (loadError: any) {
                  // If we can't load the original post, use the data from repost detail
                  // Transform the repost detail original data to match post detail format
                  console.warn('RepostScreen - Could not load original post detail, using repost data:', loadError);
                  
                  // Handle different content types - backend returns 'content' not 'post_content'
                  const postContent = original.content || original.post_content || original.description || '';
                  // Backend returns 'post_images' for posts, 'images' for forums/donations
                  const postImages = original.post_images || original.images || [];
                  const postImage = original.post_image || (postImages.length > 0 ? postImages[0]?.image_url : null);
                  
                  detail = {
                    post_id: originalPostId,
                    post_content: postContent,
                    post_title: original.post_title || '',
                    post_image: postImage,
                    post_images: postImages,
                    created_at: original.created_at,
                    user: original.user || {
                      user_id: 0,
                      f_name: 'Unknown',
                      l_name: 'User',
                      profile_pic: null
                    },
                    likes_count: 0,
                    comments_count: 0,
                    reposts_count: 0,
                    likes: [],
                    comments: [],
                    reposts: [],
                    is_liked: false,
                  };
                  
                  console.log('RepostScreen - Using repost detail fallback data:', detail);
                }
              } else {
                // Not a valid repost, just a non-existent post
                console.error('RepostScreen - Not a valid repost ID, post not found. Repost data:', repostData);
                throw new Error('Post not found');
              }
            } catch (repostError: any) {
              console.error('RepostScreen - Error loading repost detail:', repostError);
              // Re-throw the original 404 error, not the repost error
              throw error;
            }
          } else {
            throw error;
          }
        }
        
        setOriginal(detail);
        // Don't check if user already reposted - allow multiple reposts
        // Users can repost the same post multiple times, each creating a new repost
        setMyRepostId(null);
        setCaption('');
      } catch (e) {
        console.error('RepostScreen - Error loading post:', e);
        Alert.alert('Error', 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [postId, isForumPost]);

  // Use the utility function to extract all images from the original post
  const allImages = getImagesFromContent(original);

  const loadComments = async () => {
    if (!original?.post_id) return;
    try {
      const data = isForumPost 
        ? await getForumComments(original.post_id)
        : await getPostComments(original.post_id);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e) {
      console.error('[repost] load comments failed', e);
      setComments([]);
    }
  };

  const renderAvatar = (src?: string) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const s = String(src);
    
    // Handle data URIs
    if (s.startsWith('data:')) return { uri: s };
    
    // Handle absolute URLs - check if it's localhost and replace with API_BASE_URL
    if (s.startsWith('http')) {
      const localhostPattern = /^https?:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?/i;
      if (localhostPattern.test(s)) {
        const urlObj = new URL(s);
        return { uri: `${API_BASE_URL}${urlObj.pathname}${urlObj.search}` };
      }
      return { uri: s };
    }
    
    // Handle relative URLs
    const relativePath = s.startsWith('/') ? s : `/${s}`;
    return { uri: `${API_BASE_URL}${relativePath}` };
  };

  const meId = me?.id || me?.user_id;

  const handleSendComment = async () => {
    if (!original?.post_id || !commentText.trim()) return;
    try {
      setSubmittingComment(true);
      if (isForumPost) {
        await commentOnForumPost(original.post_id, commentText.trim());
      } else {
        await commentOnPost(original.post_id, commentText.trim());
      }
      setCommentText('');
      await loadComments();
    } catch (err: any) {
      console.error('[repost] send comment failed', err);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editText.trim()) return;
    try {
      if (isForumPost) {
        await updateForumComment(original.post_id, commentId, editText.trim());
      } else {
        await updateComment(original.post_id, commentId, editText.trim());
      }
      setEditingId(null);
      setEditText('');
      await loadComments();
    } catch {
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      if (isForumPost) {
        await deleteForumComment(original.post_id, commentId);
      } else {
        await deleteComment(original.post_id, commentId);
      }
      await loadComments();
    } catch {
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const openCommentModal = async () => {
    if (!original?.post_id) return;
    await loadComments();
    setCommentModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <Text style={{ fontSize: 24, color: '#333' }}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Repost</Text>
        <TouchableOpacity
        onPress={async () => {
          if (!postId) {
            Alert.alert('Error', 'Invalid post ID. Cannot repost.');
            return;
          }
          
          console.log('Repost attempt - postId:', postId, 'caption:', caption);
          
          try {
            setSubmitting(true);
            const cleaned = caption.trim();
        
            // Always create a new repost - users can repost the same post multiple times
            // Each repost will be of the original post, not the repost itself
            console.log('Creating new repost for postId:', postId, 'isForumPost:', isForumPost);
            const response = isForumPost 
              ? await repostForumPost(postId, cleaned)
              : await repostPost(postId, cleaned);
            console.log('Repost response:', response);
            
            if (response.success !== false) {
              Alert.alert(
                'Success',
                'Your repost has been published',
                [{ text: 'OK', onPress: () => router.back() }],
              );
            } else {
              Alert.alert('Error', response.message || 'Failed to repost');
            }
          } catch (e: any) {
            console.error('Repost error:', e);
            const detail =
              e?.response?.data?.detail ??
              e?.response?.data?.error ??
              e?.message ??
              'Failed to repost';
            Alert.alert('Error', detail);
          } finally {
            setSubmitting(false);
          }
        }}        
        disabled={submitting}
        style={{ padding: 10 }}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#222" />
        ) : (
          <Text style={styles.postBtn}>
            {caption.trim().length > 0 ? 'Repost' : 'Repost'}
          </Text>
        )}
      </TouchableOpacity>
      </View>
      <View style={styles.separator} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* User + caption input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <UserAvatar 
              profilePic={me?.profile_pic}
              firstName={me?.f_name}
              lastName={me?.l_name}
              size={40}
              style={styles.avatar}
            />
            <Text style={styles.meName}>{me?.name || `${me?.f_name || ''} ${me?.l_name || ''}`.trim()}</Text>
          </View>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add an optional caption..."
            multiline
          />

          {/* Nested original post card (tap to open original post detail) */}
          <TouchableOpacity style={styles.nestedCard} activeOpacity={0.8} onPress={() => { if (original?.post_id) router.push(`/posts/detail?postId=${original.post_id}`); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <UserAvatar 
                profilePic={original?.user?.profile_pic}
                firstName={original?.user?.f_name}
                lastName={original?.user?.l_name}
                size={32}
                style={styles.avatarSmall}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.origName}>{original?.user?.f_name} {original?.user?.l_name}</Text>
                <Text style={styles.origMeta}>Original post</Text>
              </View>
            </View>
            {original?.post_title ? <Text style={styles.origTitle}>{original.post_title}</Text> : null}
            {original?.post_content ? (
              <Text style={styles.origContent}>
                {renderTextWithMentions(original.post_content, [], (userId) => {
                  router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                })}
              </Text>
            ) : null}
            
            {/* Display all images */}
            {allImages.length > 0 && (
              <View style={styles.origImagesContainer}>
                {allImages.length === 1 ? (
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedImageIndex(0);
                      setImageViewerVisible(true);
                    }}
                  >
                    <Image
                      source={renderAvatar(allImages[0].image_url)}
                      style={styles.origImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.origImageGrid}>
                    {allImages.slice(0, 4).map((img, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          setSelectedImageIndex(index);
                          setImageViewerVisible(true);
                        }}
                        style={[
                          styles.origGridImage,
                          allImages.length === 2 && styles.origTwoImages,
                          allImages.length === 3 && index === 0 && styles.origThreeImagesFirst,
                          allImages.length === 3 && index > 0 && styles.origThreeImagesOther,
                        ]}
                      >
                        <Image
                          source={renderAvatar(img.image_url)}
                          style={styles.origGridImageContent}
                          resizeMode="cover"
                        />
                        {index === 3 && allImages.length > 4 && (
                          <View style={styles.origMoreImagesOverlay}>
                            <Text style={styles.origMoreImagesText}>+{allImages.length - 4}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>


          {/* Viewers for likes and reposts */}
          <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '90%', maxWidth: 420, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{viewerType === 'likes' ? 'Likes' : 'Reposts'}</Text>
                  <TouchableOpacity onPress={() => setViewerVisible(false)}><Text style={{ color: '#174f84', fontWeight: 'bold' }}>Close</Text></TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 320, marginTop: 8 }}>
                  {viewerType === 'likes' && (original?.likes || []).map((u:any, idx:number)=> (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                      <Image source={renderAvatar(u.profile_pic)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ef', marginRight: 10 }} />
                      <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>{u.f_name || ''} {u.l_name || ''}</Text>
                    </View>
                  ))}
                  {viewerType === 'reposts' && (original?.reposts || []).map((r:any)=> (
                    <View key={r.repost_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                      <Image source={renderAvatar(r.user?.profile_pic)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ef', marginRight: 10 }} />
                      <View>
                        <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>{r.user?.f_name || ''} {r.user?.l_name || ''}</Text>
                        <Text style={{ color: '#888', fontSize: 12 }}>{r.repost_date ? new Date(r.repost_date).toLocaleString() : ''}</Text>
                        {r.user?.user_id === (me?.id || me?.user_id) && (
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                            <TouchableOpacity onPress={async () => { try { const input = await Promise.resolve(caption); const next = input; await updateRepost(r.repost_id, next); Alert.alert('Updated'); } catch { Alert.alert('Error','Update failed'); } }}>
                              <Text style={{ color: '#174f84' }}>Edit caption</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={async () => { try { await deleteRepost(r.repost_id); const detail = await getPostDetail(original.post_id); setOriginal(detail); } catch { Alert.alert('Error','Delete failed'); } }}>
                              <Text style={{ color: 'red' }}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Comment Modal */}
          <Modal visible={commentModalVisible} transparent animationType="slide" onRequestClose={() => setCommentModalVisible(false)}>
            <View style={styles.commentModalOverlay}>
              <View style={styles.commentModalContent}>
                {/* Top bar */}
                <View style={styles.topBar}>
                  <TouchableOpacity onPress={() => setCommentModalVisible(false)} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#1f2937" />
                  </TouchableOpacity>
                  <Text style={styles.topTitle}>Comments • {comments.length}</Text>
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
                    renderItem={({ item: c }) => {
                      const isMine = c.user.user_id === meId;
                      const isPostOwner = original?.user?.user_id === meId || original?.user?.id === meId;
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
                            <Image source={renderAvatar(c.user?.profile_pic)} style={styles.cAvatar} />
                            <View style={{ flex: 1 }}>
                              <View style={styles.cHeaderRow}>
                                <Text style={styles.cName}>
                                  {`${c.user?.f_name || ''} ${c.user?.l_name || ''}`.trim() || 'User'}
                                </Text>
                                {!!c.date_created && (
                                  <Text style={styles.cMeta}>{dayjs(c.date_created).fromNow()}</Text>
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
                                <View style={styles.bubble}>
                                  <Text style={styles.cBody}>{c.comment_content}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                    contentContainerStyle={{
                      paddingHorizontal: 12,
                      paddingBottom: 12,
                    }}
                    ListHeaderComponent={
                      original ? (
                        <View style={styles.postCard}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Image source={renderAvatar(original.user?.profile_pic)} style={styles.avatar} />
                            <View>
                              <Text style={styles.name}>
                                {`${original.user?.f_name || ''} ${original.user?.l_name || ''}`.trim() || 'User'}
                              </Text>
                              {!!original.created_at && (
                                <Text style={styles.subtle}>{dayjs(original.created_at).fromNow()}</Text>
                              )}
                            </View>
                          </View>
                          {!!original.post_title && <Text style={styles.postTitle}>{original.post_title}</Text>}
                          {!!original.post_content && (
                            <Text style={styles.postContent}>
                              {renderTextWithMentions(original.post_content, [], (userId) => {
                                router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                              })}
                            </Text>
                          )}
                          {allImages.length > 0 && (
                            <View style={{ marginTop: 10 }}>
                              {allImages.length === 1 ? (
                                <Image
                                  source={renderAvatar(allImages[0].image_url)}
                                  style={styles.postImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                  {allImages.slice(0, 4).map((img, idx) => (
                                    <Image
                                      key={idx}
                                      source={renderAvatar(img.image_url)}
                                      style={{ width: '48%', height: 100, borderRadius: 8 }}
                                      resizeMode="cover"
                                    />
                                  ))}
                                </View>
                              )}
                            </View>
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
                  <View style={styles.composerWrap}>
                    <View style={styles.composerInputRow}>
                      <TextInput
                        style={styles.inputText}
                        value={commentText}
                        onChangeText={setCommentText}
                        placeholder="Write a comment…"
                        placeholderTextColor="#9ca3af"
                        multiline
                        returnKeyType="send"
                        blurOnSubmit
                        onSubmitEditing={handleSendComment}
                      />
                      <TouchableOpacity
                        disabled={!commentText.trim() || submittingComment}
                        onPress={handleSendComment}
                        style={[styles.sendBtn, (!commentText.trim() || submittingComment) && { opacity: 0.5 }]}
                      >
                        {submittingComment ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Ionicons name="send" size={18} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>

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
                      {(actionFor.user?.user_id === meId || original?.user?.user_id === meId || original?.user?.id === meId) && (
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
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageScrollView}
            contentOffset={{ x: selectedImageIndex * 400, y: 0 }}
          >
            {allImages.map((img, index) => (
              <Image
                key={index}
                source={renderAvatar(img.image_url)}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontWeight: 'bold', fontSize: 18, color: '#222' },
  postBtn: { color: '#222', fontWeight: 'bold', fontSize: 16 },
  separator: { height: 1, backgroundColor: '#eee' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#ccc' },
  meName: { fontWeight: 'bold', fontSize: 15, color: '#222' },
  captionInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#222', marginBottom: 12 },
  quickShareBtn: {
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 12,
    gap: 8,
  },
  quickShareText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  nestedCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, backgroundColor: '#fafafa' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: '#ccc' },
  origName: { fontWeight: '600', color: '#222' },
  origMeta: { fontSize: 12, color: '#888' },
  origTitle: { fontWeight: 'bold', fontSize: 16, color: '#222', marginBottom: 6 },
  origContent: { fontSize: 14, color: '#333', marginBottom: 8 },
  origImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#ccc' },

  // Comment Modal Styles
  commentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  commentModalContent: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  name: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#111827' 
  },
  subtle: {
    color: '#6b7280',
  },
  postTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: 6 
  },
  postContent: { 
    color: '#111827' 
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
  commentsList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cName: { 
    fontWeight: '600', 
    color: '#111827' 
  },
  cMeta: { 
    fontSize: 12, 
    color: '#6b7280', 
    marginLeft: 'auto' 
  },
  bubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  cBody: { 
    color: '#111827' 
  },
  editBox: { 
    marginTop: 6 
  },
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
  composerWrap: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  composerInputRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    gap: 8 
  },
  inputText: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    color: '#111827',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendBtnText: { 
    color: '#fff', 
    fontWeight: '700' 
  },
  backText: {
    color: '#1f2937',
    fontWeight: '600',
  },
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
  // Image viewer styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageScrollView: {
    flex: 1,
    width: '100%',
  },
  fullScreenImage: {
    width: 400,
    height: '100%',
  },
  // Original post images styles
  origImagesContainer: {
    marginTop: 8,
  },
  origImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  origGridImage: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  origGridImageContent: {
    width: '100%',
    height: '100%',
  },
  origTwoImages: {
    width: '48%',
    aspectRatio: 1,
  },
  origThreeImagesFirst: {
    width: '100%',
    aspectRatio: 2,
  },
  origThreeImagesOther: {
    width: '48%',
    aspectRatio: 1,
  },
  origMoreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  origMoreImagesText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});



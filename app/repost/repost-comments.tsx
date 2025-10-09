import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Modal, FlatList, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL, getRepostComments, commentOnRepost, updateRepostComment, deleteRepostComment, getRepostDetail, getUserInfo, updateRepost, deleteRepost, getPostLikes } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

type CommentItem = {
  comment_id: number;
  comment_content: string;
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
  const [originalLikesVisible, setOriginalLikesVisible] = useState(false);
  const [originalLikes, setOriginalLikes] = useState<any[]>([]);
  const [originalLikesLoading, setOriginalLikesLoading] = useState(false);

  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [repostData, commentsData, user] = await Promise.all([
        getRepostDetail(Number(repostId)),
        getRepostComments(Number(repostId)),
        getUserInfo()
      ]);
      console.log('Repost detail data:', repostData);
      console.log('Comments data:', commentsData);
      console.log('RepostId from params:', repostId);
      console.log('User data:', user);
      console.log('Original post data:', repostData?.original);
      console.log('Original post content:', repostData?.original?.post_content);
      console.log('Original post user:', repostData?.original?.user);
      setMe(user);
      setRepost(repostData);
      setComments(Array.isArray(commentsData?.comments) ? commentsData.comments : []);
      
      // Extract original post images
      if (repostData?.original) {
        const images: any[] = [];
        if (repostData.original.post_image) {
          images.push({ image_url: repostData.original.post_image });
        }
        if (Array.isArray(repostData.original.post_images)) {
          images.push(...repostData.original.post_images);
        }
        setOriginalImages(images);
      }
      
      // Highlight specific comment if provided
      if (highlightCommentId && commentsData?.comments) {
        const commentExists = commentsData.comments.some((c: CommentItem) => c.comment_id === Number(highlightCommentId));
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
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Handle specific error cases
      if (error?.response?.status === 404) {
        Alert.alert('Error', 'Repost not found. It may have been deleted.');
      } else {
        Alert.alert('Error', `Failed to load repost and comments: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  }, [repostId]);

  useEffect(() => {
    if (repostId) load();
  }, [repostId, load]);

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
    if (!src) return null;
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    const imageUrl = isAbs ? src : `${API_BASE_URL}${src}`;
    return { uri: imageUrl };
  };

  const meId = me?.id || me?.user_id;
  const canSend = !!repostId && !!commentText.trim() && !submitting;

  async function handleSend() {
    if (!canSend) return;
    try {
      setSubmitting(true);
      await commentOnRepost(Number(repostId), commentText.trim());
      setCommentText('');
      setInputHeight(44);
      await onRefresh();
    } catch (err: any) {
      console.error('[repost comments] send failed', err);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(commentId: number) {
    if (!editText.trim()) return;
    try {
      await updateRepostComment(Number(repostId), commentId, editText.trim());
      setEditingId(null);
      setEditText('');
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to update comment');
    }
  }

  async function handleDelete(commentId: number) {
            try {
              await deleteRepostComment(Number(repostId), commentId);
      await onRefresh();
    } catch {
              Alert.alert('Error', 'Failed to delete comment');
            }
          }

  const hideComposer = !!actionFor || editingId !== null;
  
  // Debug logging
  console.log('hideComposer:', hideComposer, 'actionFor:', !!actionFor, 'editingId:', editingId);
  const composerHeight = Math.min(Math.max(inputHeight, 44), 120);

  const loadOriginalPostLikes = async () => {
    if (!repost?.original?.post_id) return;
    try {
      setOriginalLikesLoading(true);
      const likesData = await getPostLikes(repost.original.post_id);
      setOriginalLikes(Array.isArray(likesData) ? likesData : []);
      setOriginalLikesVisible(true);
    } catch (error) {
      console.error('Error loading original post likes:', error);
      Alert.alert('Error', 'Failed to load likes');
    } finally {
      setOriginalLikesLoading(false);
    }
  };

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
                <Text style={styles.cBody}>{c.comment_content}</Text>
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
                                    onPress: async (newCaption) => {
                                      if (newCaption !== null && newCaption !== undefined) {
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
          {repost.original && (
            <TouchableOpacity 
              style={styles.originalPostContainer}
              onPress={() => {
                if (repost.original?.post_id) {
                  console.log('Navigating to original post detail:', repost.original.post_id);
                  console.log('Original post user ID:', repost.original.user?.user_id);
                  console.log('Current user ID:', meId);
                  console.log('Is owner?', meId === repost.original.user?.user_id);
                  router.push(`/posts/detail?postId=${repost.original.post_id}`);
                }
              }}
            >
              <View style={styles.originalHeader}>
                <UserAvatar 
                  profilePic={repost.original?.user?.profile_pic}
                  firstName={repost.original?.user?.f_name}
                  lastName={repost.original?.user?.l_name}
                  size={40}
                  style={styles.avatar}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.name}>
                      {`${repost.original?.user?.f_name || ''} ${repost.original?.user?.l_name || ''}`.trim() || 'User'}
                    </Text>
                    {meId === repost.original?.user?.user_id && (
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
                  {repost.original?.created_at && (
                    <Text style={styles.subtle}>{dayjs(repost.original.created_at).fromNow()}</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {meId === repost.original?.user?.user_id && (
                    <TouchableOpacity 
                      onPress={() => {
                        Alert.alert('Original Post Options', 'What would you like to do?', [
                          { 
                            text: 'Edit Post', 
                            onPress: () => {
                              // Navigate to edit post screen
                              router.push(`/posts/detail?postId=${repost.original.post_id}`);
                            }
                          },
                          { 
                            text: 'Delete Post', 
                            style: 'destructive',
                            onPress: () => {
                              Alert.alert(
                                'Delete Post',
                                'Are you sure you want to delete this post? This action cannot be undone.',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { 
                                    text: 'Delete', 
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        // Call delete post API
                                        // await deletePost(repost.original.post_id);
                                        Alert.alert('Success', 'Post deleted successfully!');
                                        router.back();
                                      } catch (error) {
                                        console.error('Error deleting post:', error);
                                        Alert.alert('Error', 'Failed to delete post. Please try again.');
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
                      <Ionicons name="ellipsis-horizontal" size={16} color="#6b7280" />
                    </TouchableOpacity>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                </View>
              </View>
              {repost.original?.post_content && repost.original.post_content.trim() ? (
                <Text style={styles.postContent}>{repost.original.post_content}</Text>
              ) : (
                <Text style={[styles.postContent, { fontStyle: 'italic', color: '#6b7280' }]}>
                  Original post content unavailable
                </Text>
              )}
              {/* Original Post Images */}
              {(() => {
                const images: any[] = [];
                const orig = repost.original || {};
                
                console.log('Original post data:', orig);
                console.log('Original post_image:', orig.post_image);
                console.log('Original post_images:', orig.post_images);
                
                // Check for single image
                if (orig.post_image) {
                  console.log('Adding single post_image:', orig.post_image);
                  images.push({ image_url: orig.post_image });
                }
                
                // Check for multiple images array
                if (Array.isArray(orig.post_images) && orig.post_images.length > 0) {
                  console.log('Adding post_images array:', orig.post_images);
                  images.push(...orig.post_images);
                }
                
                console.log('Total images found:', images.length);
                console.log('Images array:', images);
                
                if (!images.length) {
                  console.log('No images to display');
                  return null; // Don't show debug message, just return null
                }
                
                if (images.length === 1) {
                  const uri = images[0].image_url;
                  console.log('Rendering single image:', uri);
                  const imageSource = renderPostImage(uri);
                  if (!imageSource) return null;
                  
                  return (
                    <TouchableOpacity 
                      onPress={() => {
                        setSelectedImageIndex(0);
                        setImageViewerVisible(true);
                      }}
                    >
                      <Image
                        source={imageSource}
                        style={styles.postImage}
                        resizeMode="cover"
                        onError={(error) => console.log('Image load error:', error)}
                        onLoad={() => console.log('Image loaded successfully')}
                      />
                    </TouchableOpacity>
                  );
                }
                
                console.log('Rendering multiple images');
                return (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScrollContainer}>
                    {images.map((img, idx) => {
                      console.log(`Rendering image ${idx}:`, img.image_url);
                      const imageSource = renderPostImage(img.image_url);
                      if (!imageSource) return null;
                      
                      return (
                        <TouchableOpacity 
                          key={idx}
                          onPress={() => {
                            setSelectedImageIndex(idx);
                            setImageViewerVisible(true);
                          }}
                        >
                          <Image 
                            source={imageSource} 
                            style={[styles.postImage, { width: 220, marginRight: 8 }]} 
                            resizeMode="cover"
                            onError={(error) => console.log(`Image ${idx} load error:`, error)}
                            onLoad={() => console.log(`Image ${idx} loaded successfully`)}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                );
              })()}
              
              {/* Original Post Stats */}
              {repost.original && (
                <View style={styles.originalPostStats}>
                  <TouchableOpacity onPress={loadOriginalPostLikes} style={styles.originalStatButton}>
                    <Text style={styles.originalStatText}>
                      {repost.original.likes_count || 0} {repost.original.likes_count === 1 ? 'like' : 'likes'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.originalStatButton}>
                    <Text style={styles.originalStatText}>
                      {repost.original.comments_count || 0} comments
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.originalStatButton}>
                    <Text style={styles.originalStatText}>
                      {repost.original.reposts_count || 0} reposts
                    </Text>
                  </TouchableOpacity>
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
                    <TextInput
                style={[styles.inputText, { minHeight: 44, maxHeight: 120, height: composerHeight }]}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a comment…"
                placeholderTextColor="#9ca3af"
                      multiline
                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={handleSend}
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

      {/* Original Post Likes Modal */}
      {originalLikesVisible && (
        <View style={styles.likesModalOverlay}>
          <View style={styles.likesModalContent}>
            <View style={styles.likesModalHeader}>
              <Text style={styles.likesModalTitle}>Likes ({originalLikes.length})</Text>
              <TouchableOpacity onPress={() => setOriginalLikesVisible(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.likesModalScroll}>
              {originalLikesLoading ? (
                <View style={styles.likesLoadingContainer}>
                  <ActivityIndicator size="small" color="#1e3a8a" />
                  <Text style={styles.likesLoadingText}>Loading likes...</Text>
                </View>
              ) : (
                <>
                  {!originalLikes || originalLikes.length === 0 ? (
                    <View style={styles.likesEmptyContainer}>
                      <Text style={styles.likesEmptyText}>No likes yet</Text>
                    </View>
                  ) : (
                    originalLikes.map((like: any, index: number) => (
                      <View key={index} style={styles.likesItemRow}>
                        <UserAvatar 
                          profilePic={like.user?.profile_pic}
                          firstName={like.user?.f_name}
                          lastName={like.user?.l_name}
                          size={36}
                          style={styles.likesItemAvatar}
                        />
                        <Text style={styles.likesItemText}>
                          {like.user?.f_name} {like.user?.l_name}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
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
  // Original Post Stats Styles
  originalPostStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  originalStatButton: {
    flex: 1,
    alignItems: 'center',
  },
  originalStatText: {
    fontSize: 12,
    color: '#666',
  },
  // Likes Modal Styles
  likesModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  likesModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  likesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  likesModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  likesModalScroll: {
    padding: 16,
    maxHeight: 400,
  },
  likesLoadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  likesLoadingText: {
    marginTop: 8,
    color: '#666',
  },
  likesEmptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  likesEmptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
  },
  likesItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  likesItemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  likesItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
});
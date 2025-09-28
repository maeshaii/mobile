import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
  commentOnRepost,
  deleteRepostComment,
  getRepostComments,
  getRepostDetail,
  getUserInfo,
  updateRepostComment,
} from '../../services/api';

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
  const params = useLocalSearchParams();
  const repostId = Number(params.repostId);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [repost, setRepost] = useState<any | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const [submitting, setSubmitting] = useState(false);

  const [me, setMe] = useState<any>(null);
  
  // Comment editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [actionFor, setActionFor] = useState<CommentItem | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[repost-comments] Loading repost comments for repostId:', repostId);
      
      const [repostData, user] = await Promise.all([
        getRepostDetail(repostId),
        getUserInfo()
      ]);
      setMe(user);
      setRepost(repostData || null);
      
      console.log('[repost-comments] Repost data:', repostData);
      console.log('[repost-comments] Repost user:', repostData?.user);
      console.log('[repost-comments] Original post:', repostData?.original);

      console.log('[repost-comments] Fetching comments...');
      const data = await getRepostComments(repostId);
      console.log('[repost-comments] API response:', data);
      console.log('[repost-comments] Comments array:', Array.isArray(data) ? data : []);
      
      setComments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[repost-comments] load failed', e);
      setComments([]);
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
      const data = await getRepostComments(repostId);
      setComments(Array.isArray(data) ? data : []);
    } finally {
      setRefreshing(false);
    }
  }, [repostId]);

  const renderAvatar = (src?: string) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  const meId = me?.id || me?.user_id;
  const canSend = !!repostId && !!commentText.trim() && !submitting;

  async function handleSend() {
    if (!canSend) return;
    try {
      setSubmitting(true);
      console.log('[repost-comments] Submitting comment:', commentText.trim(), 'for repostId:', repostId);
      const result = await commentOnRepost(repostId, commentText.trim());
      console.log('[repost-comments] Comment submission result:', result);
      setCommentText('');
      setInputHeight(44);
      await onRefresh();
    } catch (err: any) {
      console.error('[repost-comments] send failed', err);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await deleteRepostComment(repostId, commentId);
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to delete comment');
    }
  }

  async function handleUpdate(commentId: number) {
    if (!editText.trim()) return;
    try {
      await updateRepostComment(repostId, commentId, editText.trim());
      setEditingId(null);
      setEditText('');
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to update comment');
    }
  }

  const composerHeight = Math.min(Math.max(inputHeight, 44), 120);
  const commentCount = comments.length;
  const headerTitle = `Comments · ${commentCount}`;
  const hideComposer = !!actionFor || editingId !== null;

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
                  <TouchableOpacity onPress={() => handleUpdate(c.comment_id)} style={styles.sendBtn}>
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
            paddingBottom: 12,
          }}
          ListHeaderComponent={
            repost ? (
              <View style={styles.postCard}>
                {/* Repost Header */}
                <View style={styles.repostHeader}>
                  <Image source={renderAvatar(repost.user?.profile_pic)} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {`${repost.user?.f_name || ''} ${repost.user?.l_name || ''}`.trim() || 'User'}
                    </Text>
                    {!!repost.created_at && (
                      <Text style={styles.subtle}>{dayjs(repost.created_at).fromNow()}</Text>
                    )}
                  </View>
                </View>
                
                {/* Repost Caption */}
                {repost.caption && repost.caption.trim() && (
                  <Text style={styles.caption}>{repost.caption}</Text>
                )}
                
                {/* Original Post */}
                {repost.original && (
                  <View style={styles.originalPost}>
                    <View style={styles.originalHeader}>
                      <Image source={renderAvatar(repost.original.user?.profile_pic)} style={styles.originalAvatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.originalUserName}>
                          {`${repost.original.user?.f_name || ''} ${repost.original.user?.l_name || ''}`.trim() || 'User'}
                        </Text>
                        <Text style={styles.originalMeta}>Original post</Text>
                      </View>
                    </View>
                    
                    {repost.original.post_title && (
                      <Text style={styles.originalTitle}>{repost.original.post_title}</Text>
                    )}
                    {repost.original.post_content && (
                      <Text style={styles.originalContent}>{repost.original.post_content}</Text>
                    )}
                    {repost.original.post_image && (
                      <Image
                        source={{ 
                          uri: String(repost.original.post_image).startsWith('http') 
                            ? repost.original.post_image 
                            : `${API_BASE_URL}${repost.original.post_image}` 
                        }}
                        style={styles.originalImage}
                        resizeMode="cover"
                      />
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

        {/* Action Modal */}
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

              {/* Delete: show if comment is mine OR I am the repost owner */}
              {(actionFor.user?.user_id === meId || repost?.user?.user_id === meId || repost?.user?.id === meId) && (
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
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cName: { fontWeight: '600', color: '#111827' },
  cMeta: { fontSize: 12, color: '#6b7280', marginLeft: 'auto' },
  bubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  cBody: { color: '#111827' },

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
  sendBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Edit functionality styles
  editBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: '#111827',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  
  // Action modal styles
  popupOverlay: {
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
  
  // Repost preview styles
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  caption: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginVertical: 8,
  },
  originalPost: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  originalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  originalUserName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  originalMeta: {
    fontSize: 10,
    color: '#6b7280',
  },
  originalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  originalContent: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 8,
  },
  originalImage: {
    width: '100%',
    height: 120,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
});

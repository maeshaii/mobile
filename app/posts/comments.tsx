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
  getPosts,
  getUserInfo,
  updateComment,
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

export default function PostCommentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = Number(params.postId);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [inputHeight, setInputHeight] = useState(44); // auto-grow
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [me, setMe] = useState<any>(null);

  const [actionFor, setActionFor] = useState<CommentItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CommentItem | null>(null);

  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [posts, user] = await Promise.all([getPosts(), getUserInfo()]);
      setMe(user);
      const found = Array.isArray(posts) ? posts.find((p: any) => p.post_id === postId) : null;
      setPost(found || null);

      const data = await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e) {
      console.error('[comments] load failed', e);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (postId) load();
  }, [postId, load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } finally {
      setRefreshing(false);
    }
  }, [postId]);

  const renderAvatar = (src?: string) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  const meId = me?.id || me?.user_id;
  const canSend = !!postId && !!commentText.trim() && !submitting;

  async function handleSend() {
    if (!canSend) return;
    try {
      setSubmitting(true);
      await commentOnPost(postId, commentText.trim());
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
      await updateComment(postId, commentId, editText.trim());
      setEditingId(null);
      setEditText('');
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to update comment');
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await deleteComment(postId, commentId);
      setConfirmDelete(null);
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to delete comment');
    }
  }

  const hideComposer = !!actionFor || !!confirmDelete || editingId !== null;
  const composerHeight = Math.min(Math.max(inputHeight, 44), 120);

  const commentCount = comments.length;
  const headerTitle = useMemo(
    () => `Comments · ${commentCount}`,
    [commentCount]
  );

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
              {isMine && !isEditing && (
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
            paddingBottom: hideComposer ? insets.bottom + 12 : insets.bottom + 12,
          }}
          ListHeaderComponent={
            post ? (
              <View style={styles.postCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Image source={renderAvatar(post.user?.profile_pic)} style={styles.avatar} />
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
                {!!post.post_image && (
                  <Image
                    source={renderAvatar(post.post_image)}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
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
      </KeyboardAvoidingView>

      {/* Action Sheet */}
      <Modal
        visible={!!actionFor}
        transparent
        animationType="slide"
        onRequestClose={() => setActionFor(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setActionFor(null)}
        >
          <View style={[styles.actionSheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.actionSheetTitle}>Comment Actions</Text>
            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => {
                setEditingId(actionFor!.comment_id);
                setEditText(actionFor!.comment_content);
                setActionFor(null);
              }}
            >
              <Text style={styles.sheetButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetButton, { backgroundColor: '#fee2e2' }]}
              onPress={() => {
                setConfirmDelete(actionFor);
                setActionFor(null);
              }}
            >
              <Text style={[styles.sheetButtonText, { color: '#dc2626' }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetButton, { backgroundColor: '#f3f4f6' }]}
              onPress={() => setActionFor(null)}
            >
              <Text style={[styles.sheetButtonText, { color: '#111827' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confirm Delete */}
      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.title}>Delete this comment?</Text>
            <Text style={[styles.subtle, { marginVertical: 8 }]}>
              This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setConfirmDelete(null)} style={styles.backBtn}>
                <Text style={styles.backText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(confirmDelete!.comment_id)}
                style={[styles.sendBtn, { backgroundColor: '#dc2626' }]}
              >
                <Text style={styles.sendBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
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

  // Confirm delete
  confirmOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
});

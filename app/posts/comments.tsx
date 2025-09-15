import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE_URL, commentOnPost, getPostComments, getPosts, updateComment, deleteComment } from '../../services/api';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

  const HEADER_HEIGHT = 44;
  const HEADER_TOP_PAD = 2;

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const [actionFor, setActionFor] = useState<CommentItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CommentItem | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const posts = await getPosts();
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
    };
    if (postId) load();
  }, [postId]);

  const renderAvatar = (src?: string) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  const canSend = !!postId && !!commentText.trim() && !submitting;

  async function handleSend() {
    if (!canSend) return;
    try {
      setSubmitting(true);
      const text = commentText.trim();
      await commentOnPost(postId, text);

      setCommentText('');
      const data = await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg =
        typeof err?.response?.data === 'string'
          ? err.response.data
          : err?.response?.data?.detail || err?.message || 'Failed to add comment';
      console.error('[comments] send failed:', status, apiMsg);
      Alert.alert('Could not post comment', `${status ?? 'Network'}: ${apiMsg}`);
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
      const data = await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (err) {
      Alert.alert('Failed to update comment');
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await deleteComment(postId, commentId);
      setConfirmDelete(null);
      const data = await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (err) {
      Alert.alert('Failed to delete comment');
    }
  }

  const hideComposer = !!actionFor || !!confirmDelete || editingId !== null;

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.topBar, { height: HEADER_HEIGHT, paddingTop: HEADER_TOP_PAD }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Post</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.divider} />

      {/* Content */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12 }}>
            {/* Post */}
            {post && (
              <View style={styles.postCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Image source={renderAvatar(post?.user?.profile_pic)} style={styles.avatar} />
                  <View>
                    <Text style={styles.name}>
                      {`${post?.user?.f_name || ''} ${post?.user?.l_name || ''}`.trim() || 'User'}
                    </Text>
                    {post?.created_at && <Text style={styles.subtle}>{new Date(post.created_at).toLocaleString()}</Text>}
                  </View>
                </View>
                {!!post?.post_title && <Text style={styles.postTitle}>{post.post_title}</Text>}
                {!!post?.post_content && <Text style={styles.postContent}>{post.post_content}</Text>}
                {!!post?.post_image && (
                  <Image source={renderAvatar(post.post_image)} style={styles.postImage} resizeMode="cover" />
                )}
              </View>
            )}

            {/* Comments */}
            <Text style={styles.sectionTitle}>Comments</Text>
            {comments.length === 0 ? (
              <Text style={styles.subtle}>No comments yet</Text>
            ) : (
              comments.map((c) => {
                const isMine = true; // Replace with real user check
                const isEditing = editingId === c.comment_id;
                return (
                  <TouchableOpacity
                    key={c.comment_id}
                    onLongPress={() => setActionFor(c)} // Long press opens popup
                    delayLongPress={300}
                    activeOpacity={1}
                  >
                    <View style={styles.commentRow}>
                  <Image source={renderAvatar(c.user?.profile_pic)} style={styles.cAvatar} />
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cName}>
                      {`${c.user?.f_name || ''} ${c.user?.l_name || ''}`.trim() || 'User'}
                    </Text>
                    {!!c.date_created && (
                      <Text style={styles.cMeta}>{new Date(c.date_created).toLocaleString()}</Text>
                    )}

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
                    <Text style={styles.cBody}>{c.comment_content}</Text>
                          )}
                        </View>

                        {isMine && !isEditing && (
                          <TouchableOpacity onPress={() => setActionFor(c)} style={{ padding: 6 }}>
                            <Ionicons name="ellipsis-vertical" size={18} color="#6b7280" />
                          </TouchableOpacity>
                        )}
                  </View>
                </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Composer - hidden when editing or popup open */}
          {!hideComposer && (
          <View style={[styles.composerWrap, { paddingBottom: Math.max(8, insets.bottom) }]}>
            <View style={styles.composerRow}>
              <Text style={styles.composerLabel}>Comment</Text>
              <View style={{ flex: 1 }} />
            </View>
            <View style={styles.composerInputRow}>
              <View style={styles.composerInputBox}>
                <TextInput
                  style={styles.inputText}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Write a comment…"
                  placeholderTextColor="#9ca3af"
                  multiline
                  returnKeyType="send"
                  blurOnSubmit
                  onSubmitEditing={handleSend}
                />
              </View>
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
        </View>
      </KeyboardAvoidingView>

      {/* Action Sheet */}
      <Modal visible={!!actionFor} transparent animationType="fade" onRequestClose={() => setActionFor(null)}>
        <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={() => setActionFor(null)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>Comment Actions</Text>
              <TouchableOpacity onPress={() => setActionFor(null)}>
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setEditingId(actionFor!.comment_id);
                setEditText(actionFor!.comment_content);
                setActionFor(null);
              }}
            >
              <Text style={styles.actionItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setConfirmDelete(actionFor);
                setActionFor(null);
              }}
            >
              <Text style={[styles.actionItemText, { color: '#dc2626' }]}>Delete</Text>
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
            <Text style={[styles.subtle, { marginVertical: 8 }]}>This action cannot be undone.</Text>
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
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827' 
  },
  subtle: { 
    color: '#6b7280'
  },
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
    color: '#111827' 
  },
  backBtn: { 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8, 
    backgroundColor: '#f1f5f9' 
  },
  backText: { 
    color: '#1f2937', 
    fontWeight: '600' 
  },
  divider: { 
    height: StyleSheet.hairlineWidth, 
    backgroundColor: '#e5e7eb' 
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    marginRight: 8, 
    backgroundColor: '#e5e7eb' 
  },
  name: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#111827' 
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
    marginTop: 10 },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827', 
    marginVertical: 8 
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
    backgroundColor: '#e5e7eb' 
  },
  cName: { 
    fontWeight: '600', 
    color: '#111827' 
  },
  cMeta: { 
    fontSize: 12, 
    color: '#6b7280', 
    marginBottom: 4 
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
    justifyContent: 'flex-end' 
   },
  composerWrap: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  composerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 6 },
  composerLabel: { 
    fontSize: 12, 
    color: '#64748b', 
    fontWeight: '600' 
  },
  composerInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  composerInputBox: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  inputText: { 
    color: '#111827' 
  },
  sendBtn: { 
    backgroundColor: '#1e3a8a', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 10 
  },
  sendBtnText: { 
    color: '#fff', 
    fontWeight: '700' 
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    width: '80%',
  },
  actionSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionSheetTitle: { 
    fontWeight: '700', 
    fontSize: 16, 
    color: '#111827' 
  },
  actionItem: { 
    paddingHorizontal: 16, 
    paddingVertical: 12 
  },
  actionItemText: { 
    fontSize: 15, 
    color: '#111827' 
  },
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

import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, editPost, getUserInfo, getPostCategories, getPostDetail } from '../../services/api';

interface PostModalProps {
  visible: boolean;
  postId: number | null;
  initialContent: string;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
  showCategory?: boolean; // visual only; defaults true
}

interface UserInfo {
  name?: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
}

export default function PostModal({ visible, postId, initialContent, onClose, onSaved, onDeleted, showCategory = true }: PostModalProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [content, setContent] = useState(initialContent || '');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    setContent(initialContent || '');
  }, [initialContent]);

  useEffect(() => {
    if (!visible) return;
    const fetchUser = async () => {
      try {
        setLoading(true);
        const me = await getUserInfo();
        setUser(me);
        try {
          const res = await getPostCategories();
          setCategories(res?.categories || []);
        } catch {}
        // Fetch post detail for current image and caption
        if (postId != null) {
          try {
            const detail = await getPostDetail(postId);
            // prefill caption with server value if present
            if (typeof detail?.post_content === 'string') setContent(detail.post_content);
            // keep in state for rendering image
            setPostDetail(detail);
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [visible]);

  const userName = user ? (user.name || `${user.f_name || ''} ${user.l_name || ''}`.trim()) || 'User' : 'User';
  const userAvatar = user?.profile_pic
    ? { uri: String(user.profile_pic).startsWith('http') || String(user.profile_pic).startsWith('data:') ? String(user.profile_pic) : `${API_BASE_URL}${user.profile_pic}` }
    : require('../../assets/images/sample_pic.jpg');

  const [postDetail, setPostDetail] = useState<any | null>(null);
  const imageUrl = postDetail?.post_image
    ? (String(postDetail.post_image).startsWith('http') || String(postDetail.post_image).startsWith('data:')
        ? String(postDetail.post_image)
        : `${API_BASE_URL}${postDetail.post_image}`)
    : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullscreen}>
        <View style={styles.container}>
          <View style={{ height: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) }} />
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topBarButtonLeft} onPress={onClose} disabled={submitting}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>EDIT POST</Text>
            <TouchableOpacity
              style={[styles.topBarButtonRight, submitting && styles.disabledButton]}
              onPress={async () => {
                const trimmed = (content || '').trim();
                if (!trimmed) { Alert.alert('Empty', 'Please enter content'); return; }
                if (postId == null) return;
                try {
                  setSubmitting(true);
                  await editPost(postId, { post_content: trimmed });
                  if (onSaved) await onSaved();
                  onClose();
                } catch (e) {
                  Alert.alert('Error', 'Failed to update post');
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator size="small" color="#222" /> : <Text style={styles.postButton}>SAVE</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.separator} />

          {loading ? (
            <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1e3a8a" /></View>
          ) : (
            <View style={styles.postContainer}>
              {/* User Row */}
              <View style={styles.userRow}>
                <Image source={userAvatar} style={styles.avatar} />
                <Text style={styles.userName}>{userName}</Text>
              </View>

              {/* Category Chip (visual; same look as create) */}
              {showCategory && (
                <View style={styles.categoryRow}>
                  <TouchableOpacity style={styles.categoryChip} onPress={() => setCategoryModalVisible(true)}>
                    <FontAwesome name="bookmark" size={12} color="#174f84" style={{ marginRight: 6 }} />
                    <Text style={styles.categoryChipText}>Category</Text>
                    <FontAwesome name="caret-up" size={12} color="#174f84" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Category Modal (optional) */}
              {showCategory && (
                <Modal visible={categoryModalVisible} transparent animationType="fade" onRequestClose={() => setCategoryModalVisible(false)}>
                  <View style={styles.modalOverlayCenter}>
                    <View style={styles.modalContentList}>
                      <View style={styles.modalHeaderRow}>
                        <Text style={styles.modalHeaderTitle}>Select Category</Text>
                        <TouchableOpacity onPress={() => setCategoryModalVisible(false)}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
                      </View>
                      <ScrollView style={{ maxHeight: 260 }}>
                        {categories.map((cat: any) => (
                          <View key={cat.post_cat_id} style={styles.categoryItemRow}>
                            <Text style={styles.categoryItemText}>
                              {cat.personal ? 'Personal' : cat.events ? 'Events' : cat.announcements ? 'Announcements' : cat.donation ? 'Donation' : 'Other'}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              )}

              {/* Image preview (from the post) */}
              {imageUrl && (
                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 12, backgroundColor: '#ccc' }} resizeMode="cover" />
              )}

              {/* Content */}
              <TextInput
                style={styles.input}
                placeholder="What's on your mind?"
                multiline
                numberOfLines={6}
                value={content}
                onChangeText={setContent}
                maxLength={1000}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative', height: 40 },
  topBarButtonLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 10 },
  topBarButtonRight: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 10 },
  closeIcon: { fontSize: 24, color: '#333' },
  title: { fontWeight: 'bold', fontSize: 16, color: '#222', textAlign: 'center', flex: 1 },
  postButton: { color: '#222', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { opacity: 0.6 },
  separator: { height: 1, backgroundColor: '#E0E0E0', width: '100%', marginBottom: 10 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  postContainer: { },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  userName: { fontWeight: 'bold', fontSize: 15, color: '#222' },
  categoryRow: { marginTop: -10, marginBottom: 12, paddingLeft: 50 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', paddingVertical: 6, paddingHorizontal: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  categoryChipText: { fontSize: 12, color: '#174f84', fontWeight: '600' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContentList: { backgroundColor: '#fff', borderRadius: 12, width: '80%', maxWidth: 420, paddingBottom: 10 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  modalCloseText: { fontSize: 18, color: '#666' },
  categoryItemRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  categoryItemText: { fontSize: 14, color: '#333' },
  input: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', padding: 12, fontSize: 15, minHeight: 100, textAlignVertical: 'top', color: '#222' },
});



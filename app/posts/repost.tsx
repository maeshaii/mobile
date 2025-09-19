import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, getPostDetail, getUserInfo, repostPost, likePost, unlikePost, commentOnPost, updateRepost, deleteRepost } from '../../services/api';

export default function RepostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = typeof params.postId === 'string' ? parseInt(params.postId) : undefined;
  const [me, setMe] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caption, setCaption] = useState('');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'reposts' | null>(null);
  const [myRepostId, setMyRepostId] = useState<number | null>(null); // Used by Mobile: existing repost id if already reposted

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const [u, detail] = await Promise.all([
          getUserInfo(),
          postId ? getPostDetail(postId) : Promise.resolve(null),
        ]);
        setMe(u);
        setOriginal(detail);
        // Detect if current user already reposted
        try {
          const meId = (u?.id || u?.user_id);
          const mine = Array.isArray(detail?.reposts) ? detail.reposts.find((r:any)=> (r.user?.user_id) === meId) : null;
          setMyRepostId(mine?.repost_id || null);
          if (mine?.caption) setCaption(String(mine.caption));
        } catch {}
      } catch (e) {
        Alert.alert('Error', 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [postId]);

  const meAvatar = me?.profile_pic
    ? { uri: (String(me.profile_pic).startsWith('http') || String(me.profile_pic).startsWith('data:')) ? String(me.profile_pic) : `${API_BASE_URL}${me.profile_pic}` }
    : require('../../assets/images/sample_pic.jpg');

  const origAvatar = original?.user?.profile_pic
    ? { uri: (String(original.user.profile_pic).startsWith('http') || String(original.user.profile_pic).startsWith('data:')) ? String(original.user.profile_pic) : `${API_BASE_URL}${original.user.profile_pic}` }
    : require('../../assets/images/sample_pic.jpg');

  const imageUrl = original?.post_image
    ? (String(original.post_image).startsWith('http') || String(original.post_image).startsWith('data:') ? String(original.post_image) : `${API_BASE_URL}${original.post_image}`)
    : null;

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
          if (!postId) return;
          try {
            setSubmitting(true);
            const cleaned = caption.trim();
        
            if (myRepostId) {
              // update my existing repost caption
              await updateRepost(myRepostId, cleaned);
              Alert.alert(
                cleaned ? 'Saved' : 'Saved',
                'Your repost caption has been updated',
                [{ text: 'OK', onPress: () => router.back() }],
              );
            } else {
              // create repost; helper will omit caption if empty
              await repostPost(postId, cleaned);
              Alert.alert(
                cleaned ? 'Reposted' : 'Shared',
                'Your repost has been published',
                [{ text: 'OK', onPress: () => router.back() }],
              );
            }
          } catch (e: any) {
            const detail =
              e?.response?.data?.detail ??
              (e?.response?.data ? JSON.stringify(e.response.data) : e?.message) ??
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
            {caption.trim().length > 0 ? 'Save' : 'Share'}
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
            <Image source={meAvatar} style={styles.avatar} />
            <Text style={styles.meName}>{me?.name || `${me?.f_name || ''} ${me?.l_name || ''}`.trim()}</Text>
          </View>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add an optional caption..."
            multiline
          />
          {myRepostId ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              <TouchableOpacity
                onPress={async () => { try { await deleteRepost(myRepostId); setMyRepostId(null); setCaption(''); Alert.alert('Deleted','Your repost was removed'); } catch { Alert.alert('Error','Failed to delete'); } }}
              >
                <Text style={{ color: 'red', fontWeight: 'bold' }}>Delete Repost</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Nested original post card (tap to open original comments for now) */}
          <TouchableOpacity style={styles.nestedCard} activeOpacity={0.8} onPress={() => { if (original?.post_id) router.push(`/posts/comments?postId=${original.post_id}`); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Image source={origAvatar} style={styles.avatarSmall} />
              <View style={{ flex: 1 }}>
                <Text style={styles.origName}>{original?.user?.f_name} {original?.user?.l_name}</Text>
                <Text style={styles.origMeta}>Original post</Text>
              </View>
            </View>
            {original?.post_title ? <Text style={styles.origTitle}>{original.post_title}</Text> : null}
            {original?.post_content ? <Text style={styles.origContent}>{original.post_content}</Text> : null}
            {imageUrl && (
              <Image source={{ uri: imageUrl }} style={styles.origImage} resizeMode="cover" />
            )}
          </TouchableOpacity>

          {/* Counts row for the original post */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 10 }}>
            <TouchableOpacity onPress={async () => { try { if (original?.post_id) { const detail = await getPostDetail(original.post_id); setOriginal(detail); setViewerType('likes'); setViewerVisible(true); } } catch {} }}>
              <Text style={{ fontSize: 12, color: '#666' }}>{original?.likes_count || 0} {(original?.likes_count || 0) === 1 ? 'like' : 'likes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { if (original?.post_id) router.push(`/posts/comments?postId=${original.post_id}`); }}>
              <Text style={{ fontSize: 12, color: '#666' }}>{original?.comments_count || 0} {(original?.comments_count || 0) === 1 ? 'comment' : 'comments'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { try { if (original?.post_id) { const detail = await getPostDetail(original.post_id); setOriginal(detail); setViewerType('reposts'); setViewerVisible(true); } } catch {} }}>
              <Text style={{ fontSize: 12, color: '#666' }}>{original?.reposts_count || 0} {(original?.reposts_count || 0) === 1 ? 'share' : 'shares'}</Text>
            </TouchableOpacity>
          </View>

          {/* Actions for original post */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }}>
            <TouchableOpacity
              style={{ alignItems: 'center' }}
              onPress={async () => {
                if (!original?.post_id) return;
                try {
                  const meId = (me?.id || me?.user_id);
                  const liked = !!(original?.likes || []).some((l:any)=> (l.user_id||l.user?.user_id) === meId);
                  if (liked) await unlikePost(original.post_id); else await likePost(original.post_id);
                  const detail = await getPostDetail(original.post_id);
                  setOriginal(detail);
                } catch { Alert.alert('Error','Failed to update like'); }
              }}
            >
              <FontAwesome name={(original && Array.isArray(original.likes) && original.likes.some((l:any)=> (l.user_id||l.user?.user_id) === (me?.id||me?.user_id))) ? 'thumbs-up' : 'thumbs-o-up'} size={18} color={(original && Array.isArray(original.likes) && original.likes.some((l:any)=> (l.user_id||l.user?.user_id) === (me?.id||me?.user_id))) ? '#1e3a8a' : '#555'} />
              <Text style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: 'center' }}
              onPress={() => { if (original?.post_id) router.push(`/posts/comments?postId=${original.post_id}`); }}
            >
              <FontAwesome name="comment-o" size={18} color="#555" />
              <Text style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Comment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: 'center' }}
              onPress={async () => { if (!original?.post_id) return; try { await repostPost(original.post_id); const detail = await getPostDetail(original.post_id); setOriginal(detail); Alert.alert('Reposted'); } catch { Alert.alert('Error','Failed to repost'); } }}
            >
              <FontAwesome name="retweet" size={18} color="#555" />
              <Text style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Share</Text>
            </TouchableOpacity>
          </View>

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
                      <Image source={{ uri: (u.profile_pic && (String(u.profile_pic).startsWith('http') || String(u.profile_pic).startsWith('data:'))) ? u.profile_pic : (u.profile_pic ? `${API_BASE_URL}${u.profile_pic}` : '') }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ef', marginRight: 10 }} />
                      <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>{u.f_name || ''} {u.l_name || ''}</Text>
                    </View>
                  ))}
                  {viewerType === 'reposts' && (original?.reposts || []).map((r:any)=> (
                    <View key={r.repost_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                      <Image source={{ uri: (r.user?.profile_pic && (String(r.user.profile_pic).startsWith('http') || String(r.user.profile_pic).startsWith('data:'))) ? r.user?.profile_pic : (r.user?.profile_pic ? `${API_BASE_URL}${r.user.profile_pic}` : '') }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ef', marginRight: 10 }} />
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 8, paddingBottom: 8 },
  headerTitle: { fontWeight: 'bold', fontSize: 18, color: '#222' },
  postBtn: { color: '#222', fontWeight: 'bold', fontSize: 16 },
  separator: { height: 1, backgroundColor: '#eee' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#ccc' },
  meName: { fontWeight: 'bold', fontSize: 15, color: '#222' },
  captionInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#222', marginBottom: 12 },
  nestedCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, backgroundColor: '#fafafa' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: '#ccc' },
  origName: { fontWeight: '600', color: '#222' },
  origMeta: { fontSize: 12, color: '#888' },
  origTitle: { fontWeight: 'bold', fontSize: 16, color: '#222', marginBottom: 6 },
  origContent: { fontSize: 14, color: '#333', marginBottom: 8 },
  origImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#ccc' },
});



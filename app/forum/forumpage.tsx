import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, commentOnPost, followUser, getPosts, getUserInfo, likePost, repostPost, unlikePost } from '../../services/api';

const forumLogo = require('../../assets/images/wny_logo.jpg');

const orgInfo = {
  name: 'CCICT Forum',
  username: '@CCICT_FORUM',
  bio: 'CCICT Forum CTU Main-Campus',
  profile_pic: forumLogo,
};

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  type?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  user: { user_id: number; f_name: string; l_name: string; profile_pic?: string | null };
}

interface UserProfile {
  profile_pic?: string;
}

export default function CCICTPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks < 5) return `${diffWeeks}w`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) return `${diffMonths}mo`;
      const diffYears = Math.floor(diffDays / 365);
      return `${diffYears}y`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userInfo = await getUserInfo();
        setUser(userInfo);
        const allPosts = await getPosts();
        // Show only forum posts if type is 'forum' (fallback to all if type not present)
        const forumPosts = Array.isArray(allPosts) ? allPosts.filter((p: any) => (p.type || '').toLowerCase() === 'forum') : [];
        setPosts(forumPosts);
      } catch (e) {
        setUser(null);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Blue Header with Back Button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* Org Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image source={orgInfo.profile_pic} style={styles.profileImage} />
        </View>
        <Text style={styles.profileName}>{orgInfo.name}</Text>
        <Text style={styles.profileUsername}>{orgInfo.username}</Text>
        <View style={styles.bioRow}>
          <Text style={styles.bioText}>{orgInfo.bio}</Text>
        </View>
      </View>
      {/* Start a Post */}
      <View style={styles.startPostCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={user && user.profile_pic ? { uri: (String(user.profile_pic).startsWith('http') || String(user.profile_pic).startsWith('data:')) ? String(user.profile_pic) : `${API_BASE_URL}${user.profile_pic}` } : require('../../assets/images/sample_pic.jpg')} style={styles.avatar} />
          <TouchableOpacity style={styles.startPostInput} onPress={() => router.push({ pathname: '/posts/post', params: { type: 'forum' } })}>
            <Text style={{ color: '#888' }}>Start a post</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Posts */}
      {loading ? null : posts.map((post) => (
        <View key={post.post_id} style={styles.postCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Image source={post.user?.profile_pic ? { uri: (String(post.user.profile_pic).startsWith('http') || String(post.user.profile_pic).startsWith('data:')) ? String(post.user.profile_pic) : `${API_BASE_URL}${post.user.profile_pic}` } : orgInfo.profile_pic} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.postName}>{post.user?.f_name} {post.user?.l_name}</Text>
              <Text style={styles.postMeta}>{formatDate(post.created_at)} • <FontAwesome name="globe" size={12} color="#888" /></Text>
            </View>
          </View>
          {post.post_title ? <Text style={styles.postName}>{post.post_title}</Text> : null}
          <Text style={styles.postContent}>{post.post_content}</Text>
          {post.post_image ? (<Image source={{ uri: (String(post.post_image).startsWith('http') || String(post.post_image).startsWith('data:')) ? String(post.post_image) : `${API_BASE_URL}${post.post_image}` }} style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 8 }} />) : null}
          <View style={styles.postActions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  if (post.is_liked) {
                    await unlikePost(post.post_id);
                    setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, is_liked: false, likes_count: Math.max(0, (p.likes_count||0)-1) } : p));
                  } else {
                    await likePost(post.post_id);
                    setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, is_liked: true, likes_count: (p.likes_count||0)+1 } : p));
                  }
                } catch (e) {
                  Alert.alert('Error', 'Failed to update like');
                }
              }}
            >
              <FontAwesome name={post.is_liked ? 'thumbs-up' : 'thumbs-o-up'} size={16} color="#888" />
              <Text style={styles.actionText}>{post.likes_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  await commentOnPost(post.post_id, 'Nice post!');
                  setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, comments_count: (p.comments_count||0)+1 } : p));
                } catch (e) {
                  Alert.alert('Error', 'Failed to comment');
                }
              }}
            >
              <FontAwesome name="comment-o" size={16} color="#888" />
              <Text style={styles.actionText}>{post.comments_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  await repostPost(post.post_id);
                  Alert.alert('Reposted', 'Post reposted successfully');
                } catch (e) {
                  Alert.alert('Error', 'Failed to repost');
                }
              }}
            >
              <FontAwesome name="retweet" size={16} color="#888" />
              <Text style={styles.actionText}>{post.reposts_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  await followUser(post.user.user_id);
                  Alert.alert('Followed', `You followed ${post.user.f_name} ${post.user.l_name}`);
                } catch (e) {
                  Alert.alert('Error', 'Failed to follow');
                }
              }}
            >
              <FontAwesome name="user-plus" size={16} color="#888" />
              <Text style={styles.actionText}>Follow</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 0,
  },
  headerContainer: {
    position: 'relative',
  },
  headerBg: {
    height: 160,
    backgroundColor: '#174f84',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    width: '100%',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 2,
    alignItems: 'center',
    marginTop: -30,
    paddingTop: 60,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    width: '100%',
  },
  profileImageWrapper: {
    position: 'absolute',
    top: -40,
    left: '50%',
    marginLeft: -50,
    zIndex: 2,
    borderWidth: 4,
    borderColor: '#fff',
    borderRadius: 50,
    width: 100,
    height: 100,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 50,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#222',
    textAlign: 'center',
  },
  profileUsername: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    textAlign: 'center',
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#444',
    marginRight: 10,
  },
  startPostCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  startPostInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
  },
  postName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
  },
  postMeta: {
    fontSize: 12,
    color: '#888',
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 20,
  },
});

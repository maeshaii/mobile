import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getPostsByUserType, getUserInfo } from '../../services/api';
import OrgPostCard from '../posts/OrgPostCard';

const pesoLogo = require('../../assets/images/peso_logo.jpg');

const orgInfo = {
  name: 'PESO',
  username: '@PESO_CTU_MAIN_CAMPUS',
  bio: 'Peso CTU-Main Campus',
  profile_pic: pesoLogo,
};

interface Post {
  id: number;
  post_title: string;
  post_content: string;
  post_image?: string;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  comments: Comment[];
}

interface Comment {
  id: number;
  comment_content: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
}

export default function PESOPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPosts();
    getUserInfo().then(setCurrentUser);
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const postsData = await getPostsByUserType('peso');
      console.log('Fetched PESO posts:', postsData);
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching PESO posts:', error);
      Alert.alert('Error', 'Failed to load PESO posts. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLikeToggle = (postId: number, isLiked: boolean) => {
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === postId
          ? {
              ...p,
              is_liked: isLiked,
              likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
            }
          : p
      )
    );
  };

  const handleCommentAdded = (postId: number, comments: Comment[]) => {
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === postId ? { ...p, comments: comments, comments_count: comments.length } : p
      )
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} tintColor="#1e3a8a" />
      }
    >
      {/* Blue Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => router.push('/messages/chatmessage?name=PESO')}
        >
          <FontAwesome name="envelope" size={20} color="#fff" />
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

      {/* Posts */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#174f84" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.noPostsContainer}>
          <Text style={styles.noPostsText}>No PESO posts yet</Text>
          <Text style={styles.noPostsSubtext}>Posts from PESO will appear here</Text>
        </View>
      ) : (
        posts.map(post => (
          <OrgPostCard
            key={post.id}
            post={post}
            orgInfo={orgInfo}
            onLikeToggle={handleLikeToggle}
            onCommentAdded={handleCommentAdded}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
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
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
  },
  messageButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#174f84',
  },
  noPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  noPostsText: {
    fontSize: 16,
    color: '#888',
  },
  noPostsSubtext: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
  },
});

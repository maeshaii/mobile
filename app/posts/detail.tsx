import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getPostDetail } from '../../services/api';
import PostCard from './postCard';

export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const postId = typeof params.postId === 'string' ? parseInt(params.postId) : undefined;
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const detail = await getPostDetail(postId);
      setPost(detail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [postId]);

  if (!postId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Missing postId</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Post not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: '#1e3a8a' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 10, backgroundColor: '#fff' }}>
      <PostCard post={post} />
    </View>
  );
}



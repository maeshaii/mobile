import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
      console.log('Loading post detail for postId:', postId);
      const detail = await getPostDetail(postId);
      console.log('Post detail loaded:', detail);
      setPost(detail);
    } catch (error) {
      console.error('Error loading post detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [postId]);

  if (!postId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Post Detail</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Missing postId</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Post Detail</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Post Detail</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Post not found</Text>
          <Text style={styles.errorSubtitle}>
            The post you're looking for doesn't exist or you don't have permission to view it.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Post Detail</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.divider} />
      <View style={styles.content}>
        <PostCard post={post} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
  },
  content: {
    flex: 1,
    padding: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 18,
    marginBottom: 10,
    color: '#111827',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});



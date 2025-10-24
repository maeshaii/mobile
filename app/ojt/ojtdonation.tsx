import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput } from 'react-native';
import { followUser, getUserInfo, checkFollowStatus, getDonationPosts, createDonationPost, getDonationLikes, getDonationReposts } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import DonationPostCard from '../donation/DonationPostCard';
import RepostCard from '../repost/RepostCard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import MentionInput from '../../components/MentionInput';
import { convertImageToBase64 } from '../../utils/imageUtils';

const donationLogo = require('../../assets/images/wny_logo.jpg');

const orgInfo = {
  name: 'OJT Donation Page',
  profile_pic: donationLogo,
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
  is_liked: boolean;
  is_reposted?: boolean;
  user: {
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
  item_type?: string;
  repost_id?: number;
  repost_date?: string;
  repost_caption?: string;
  reposter?: {
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
  original_post?: PostItem;
}

export default function OJTDonationPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<any[]>([]);

  const loadDonationPosts = async () => {
    try {
      setLoading(true);
      const response = await getDonationPosts();
      if (response.success) {
        setPosts(response.posts || []);
      } else {
        Alert.alert('Error', response.error || 'Failed to load donation posts');
      }
    } catch (error) {
      console.error('Error loading donation posts:', error);
      Alert.alert('Error', 'Failed to load donation posts');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDonationPosts().finally(() => setRefreshing(false));
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    loadDonationPosts();
  }, []);

  const handleCreatePost = async () => {
    if (!postTitle.trim() || !postContent.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setPosting(true);
    try {
      let imageBase64 = null;
      if (selectedImage) {
        imageBase64 = await convertImageToBase64(selectedImage);
      }

      const response = await createDonationPost({
        content: postContent.trim(),
        image: imageBase64,
        mentioned_users: mentionedUsers.map(u => u.user_id)
      });

      if (response.success) {
        Alert.alert('Success', 'Donation post created successfully!');
        setPostTitle('');
        setPostContent('');
        setSelectedImage(null);
        setMentionedUsers([]);
        setShowCreateModal(false);
        loadDonationPosts();
      } else {
        Alert.alert('Error', response.error || 'Failed to create donation post');
      }
    } catch (error) {
      console.error('Error creating donation post:', error);
      Alert.alert('Error', 'Failed to create donation post');
    } finally {
      setPosting(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const renderPost = (item: PostItem, index: number) => {
    if (item.item_type === 'repost') {
      return (
        <RepostCard
          key={`repost-${item.repost_id}`}
          repost={item}
          currentUserId={user?.user_id || user?.id}
          formatTime={(date: string) => {
            const now = new Date();
            const postDate = new Date(date);
            const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);
            
            if (diffInSeconds < 60) return 'Just now';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
            return `${Math.floor(diffInSeconds / 86400)}d ago`;
          }}
          onRefresh={loadDonationPosts}
        />
      );
    }

    return (
      <DonationPostCard
        key={`post-${item.post_id}`}
        post={item}
        currentUserId={user?.user_id || user?.id}
        formatTime={(date: string) => {
          const now = new Date();
          const postDate = new Date(date);
          const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);
          
          if (diffInSeconds < 60) return 'Just now';
          if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
          if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
          return `${Math.floor(diffInSeconds / 86400)}d ago`;
        }}
        onRefresh={loadDonationPosts}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OJT Donations</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createButton}>
          <FontAwesome name="plus" size={20} color="#007bff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading donation posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No donation posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to create a donation request!</Text>
          </View>
        ) : (
          posts.map((item, index) => renderPost(item, index))
        )}
      </ScrollView>

      {/* Create Post Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Donation Post</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.closeButton}
              >
                <FontAwesome name="times" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.titleInput}
              placeholder="Donation Title *"
              value={postTitle}
              onChangeText={setPostTitle}
              maxLength={100}
            />
            
            <MentionInput
              value={postContent}
              onChangeText={setPostContent}
              onMentionedUsersChange={setMentionedUsers}
              placeholder="Describe your donation request... *"
              style={styles.contentInput}
              multiline
              maxLength={1000}
            />
            
            {selectedImage && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                <TouchableOpacity onPress={removeImage} style={styles.removeImageButton}>
                  <FontAwesome name="times" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
              <FontAwesome name="camera" size={16} color="#007bff" />
              <Text style={styles.imageButtonText}>Add Image</Text>
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.submitButton, posting && styles.disabledButton]}
                onPress={handleCreatePost}
                disabled={posting || !postTitle.trim() || !postContent.trim()}
              >
                <Text style={styles.submitButtonText}>
                  {posting ? 'Creating...' : 'Create Post'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  createButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 8,
    marginBottom: 16,
  },
  imageButtonText: {
    color: '#007bff',
    marginLeft: 8,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  submitButton: {
    backgroundColor: '#007bff',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

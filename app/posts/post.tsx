import { FontAwesome } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, createPost, createForumPost, getPostCategories, getUserInfo } from '../../services/api';
// @ts-ignore
import * as ImagePicker from 'expo-image-picker';

interface UserInfo {
  name?: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
}

interface PostCategory {
  post_cat_id: number;
  events: boolean;
  announcements: boolean;
  donation: boolean;
  personal: boolean;
}

export default function PostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<UserInfo | null>(null);
  // Removed title as requested
  const [postContent, setPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Fetch user info and categories on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [userInfo, categoriesResponse] = await Promise.all([
          getUserInfo(),
          getPostCategories()
        ]);
        
        setUser(userInfo);
        // Extract categories from the response
        const categoriesData = categoriesResponse.categories || [];
        console.log('Categories response:', categoriesResponse);
        console.log('Categories data:', categoriesData);
        setCategories(categoriesData);
        
        // Set default category to personal (assuming personal has post_cat_id = 4)
        const personalCategory = categoriesData.find((cat: PostCategory) => cat.personal);
        if (personalCategory) {
          setSelectedCategory(personalCategory.post_cat_id);
        } else {
          console.log('No personal category found');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Error', 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    if (!postContent.trim()) {
      Alert.alert('Error', 'Please enter some content for your post');
      return;
    }

    const postType = (typeof params.type === 'string' && params.type) ? params.type : 'personal';
    
    // Only require category for non-forum posts
    if (postType !== 'forum' && !selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    try {
      setSubmitting(true);
      
      // Handle image - convert local file to base64 if needed
      let postImage = '';
      if (selectedImage) {
        if (selectedImage.startsWith('file://')) {
          try {
            // Convert local file to base64
            const base64 = await FileSystem.readAsStringAsync(selectedImage, {
              encoding: FileSystem.EncodingType?.Base64 || 'base64',
            });
            postImage = `data:image/jpeg;base64,${base64}`;
          } catch (error) {
            console.error('Error converting image to base64:', error);
            postImage = '';
          }
        } else {
          postImage = selectedImage;
        }
      }
      
      const postType = (typeof params.type === 'string' && params.type) ? params.type : 'personal';
      
      console.log('Post type detected:', postType);
      console.log('Selected category:', selectedCategory);
      console.log('Categories available:', categories);

      if (postType === 'forum') {
        // Use forum API for forum posts
        const forumData = {
          title: '', // Forum posts don't require title
          content: postContent.trim(),
          image: postImage
        };
        console.log('Submitting forum post data:', forumData);
        await createForumPost(forumData);
      } else {
        // Use regular post API for all other posts
        const postData = {
          post_title: '',
          post_content: postContent.trim(),
          post_image: postImage,
          post_cat_id: selectedCategory!,  // We've already validated it's not null for non-forum posts
          type: postType,
        };
        console.log('Submitting regular post data:', postData);
        console.log('Post image data:', postImage ? 'Present' : 'Not present');
        console.log('Post image length:', postImage ? postImage.length : 0);
        await createPost(postData);
      }
      
      Alert.alert('Success', 'Post created successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const userName = user ? (user.name || `${user.f_name || ''} ${user.l_name || ''}`.trim()) || 'User' : 'User';
  const userAvatar = user?.profile_pic
    ? { uri: String(user.profile_pic).startsWith('http') || String(user.profile_pic).startsWith('data:') ? String(user.profile_pic) : `${API_BASE_URL}${user.profile_pic}` }
    : require('../../assets/images/sample_pic.jpg');

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.topBarButtonLeft} 
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CREATE A POST</Text>
        <TouchableOpacity 
          style={[styles.topBarButtonRight, submitting && styles.disabledButton]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#222" />
          ) : (
            <Text style={styles.postButton}>POST</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.separator} />
    
      {/* User Info */}
      <View style={styles.postContainer}>
        <View style={styles.userRow}>
          <Image source={userAvatar} style={styles.avatar} />
          <Text style={styles.userName}>{userName}</Text>
        </View>
        {/* Category Chip - Only show for non-forum posts */}
        {(typeof params.type !== 'string' || params.type !== 'forum') && (
          <View style={styles.categoryRow}>
            <TouchableOpacity style={styles.categoryChip} onPress={() => setCategoryModalVisible(true)}>
              <FontAwesome name="bookmark" size={12} color="#174f84" style={{ marginRight: 6 }} />
              <Text style={styles.categoryChipText}>Category</Text>
              <FontAwesome name="caret-up" size={12} color="#174f84" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* Category Modal */}
        <Modal
          visible={categoryModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity
                  onPress={() => setCategoryModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.categoryList}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.post_cat_id}
                    style={[
                      styles.categoryItem,
                      selectedCategory === category.post_cat_id && styles.selectedCategoryItem
                    ]}
                    onPress={() => {
                      console.log('Category selected:', category);
                      setSelectedCategory(category.post_cat_id);
                      setCategoryModalVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.categoryItemText,
                      selectedCategory === category.post_cat_id && styles.selectedCategoryItemText
                    ]}>
                      {category.personal ? 'Personal' : 
                       category.events ? 'Events' : 
                       category.announcements ? 'Announcements' : 
                       category.donation ? 'Donation' : 'Other'}
                    </Text>
                    {selectedCategory === category.post_cat_id && (
                      <FontAwesome name="check" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>


        {/* Post Input */}
        <TextInput
          style={styles.input}
          placeholder="Start a post..."
          multiline
          numberOfLines={6}
          value={postContent}
          onChangeText={setPostContent}
          maxLength={1000}
        />

        {/* Character Count */}
        <Text style={styles.charCount}>{postContent.length}/1000</Text>
      </View> 

      {/* Add Image Section */}
      <View style={styles.addImageContainer}>
        <TouchableOpacity style={styles.addImageRow} onPress={pickImage}>
          <FontAwesome name="image" size={32} color="#4B944D" style={styles.addImageIcon} />
          <Text style={styles.addImageText}>
            {selectedImage ? 'Image Selected' : 'Add Image'}
          </Text>
        </TouchableOpacity>
        {selectedImage && (
          <View style={styles.selectedImageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removeImageText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: 16 ,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 35,
    position: 'relative',
    height: 40,
},
topBarButtonLeft: {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  justifyContent: 'center',
  paddingHorizontal: 10,
},
topBarButtonRight: {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  justifyContent: 'center',
  paddingHorizontal: 10,
},
  closeIcon: { 
    fontSize: 24, 
    color: '#333' 
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
    textAlign: 'center',
    flex: 1,
},
  postButton: { 
    color: '#222', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12,
    marginTop: 10,
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    marginRight: 10 
  },
  userName: { 
    fontWeight: 'bold', 
    fontSize: 15, 
    color: '#222',
    marginTop: -15,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 16,
    textAlignVertical: 'top',
    color: '#D9D9D9',
  },
  addImageContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    // iOS shadow (top only)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    // Android shadow
    elevation: 4,
    // Optional: add a thin border at the top
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
    marginTop: 30,
  },
  addImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addImageIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  addImageText: {
    color: '#4B944D',
    fontWeight: 'bold',
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
    marginBottom: 10,
  },
  postContainer: {
    marginTop: 1,
    borderTopColor: '#1C4E80',
  },
  categoryRow: {
    marginTop: -25,
    marginBottom: 12,
    paddingLeft: 50,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 6,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#174f84',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D9D9D9',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  categoryList: {
    padding: 10,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedCategoryItem: {
    backgroundColor: '#1C4E80',
  },
  categoryItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedCategoryItemText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    color: '#D9D9D9',
  },
  charCount: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    marginTop: -10,
    marginBottom: 10,
  },
  selectedImageContainer: {
    position: 'relative',
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  removeImageText: {
    color: '#fff',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  disabledButton: {
    opacity: 0.7,
  },

});

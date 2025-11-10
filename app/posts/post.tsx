import { FontAwesome } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, createPost, createForumPost, getUserInfo } from '../../services/api';
// @ts-ignore
import * as ImagePicker from 'expo-image-picker';
import UserAvatar from '../../components/UserAvatar';

interface UserInfo {
  name?: string;
  f_name?: string;
  l_name?: string;
  profile_pic?: string;
}


export default function PostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<UserInfo | null>(null);
  // Removed title as requested
  const [postContent, setPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]); // Multiple images
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch user info on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const userInfo = await getUserInfo();
        setUser(userInfo);
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pickImage = async () => {
    try {
      console.log('Starting image picker...');
      
      // Request permissions first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission result:', permissionResult);
      
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library to attach images.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable editing to allow multiple selection
        quality: 0.5, // Reduced quality to reduce file size
        allowsMultipleSelection: true, // Enable multiple image selection
      });

      console.log('Image picker result:', result);
      console.log('Canceled:', result.canceled);
      console.log('Assets:', result.assets);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`Selected ${result.assets.length} images`);
        const maxImages = 30;
        const newImages = result.assets.slice(0, maxImages - selectedImages.length);
        console.log(`Adding ${newImages.length} new images (max: ${maxImages}, current: ${selectedImages.length})`);
        
        // Store the original file URIs instead of converting to base64
        const imageUris: string[] = [];
        for (const asset of newImages) {
          try {
            console.log('Storing image URI:', asset.uri);
            imageUris.push(asset.uri);
            console.log('Successfully stored image URI');
          } catch (error) {
            console.error('Error storing image URI:', error);
          }
        }
        
        console.log(`Successfully stored ${imageUris.length} image URIs`);
        setSelectedImages(prev => {
          const newList = [...prev, ...imageUris];
          console.log(`Total images now: ${newList.length}`);
          return newList;
        });
      } else {
        console.log('No images selected or picker was canceled');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!postContent.trim()) {
      Alert.alert('Error', 'Please enter some content for your post');
      return;
    }

    const postType = (typeof params.type === 'string' && params.type) ? params.type : 'personal';

    try {
      setSubmitting(true);
      console.log('Starting post submission...');
      console.log('Post type:', postType);
      console.log('Selected images count:', selectedImages.length);
      
      // Show progress for image uploads
      if (selectedImages.length > 0 || selectedImage) {
        Alert.alert('Processing', 'Compressing images and preparing upload...', [], { cancelable: false });
      }
      
      // Handle images - use multiple images if available, fallback to single image
      let postImage = '';
      let postImages: string[] = [];
      
      if (selectedImages.length > 0) {
        // Use multiple images - compress and convert to base64
        try {
          const base64Images = [];
          for (let i = 0; i < selectedImages.length; i++) {
            const imageUri = selectedImages[i];
            console.log(`Processing image ${i + 1}/${selectedImages.length}: ${imageUri}`);
            
            if (imageUri.startsWith('file://')) {
              // Compress the image first
              const compressedImage = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                  { resize: { width: 800 } }, // Resize to max width of 800px
                ],
                { 
                  compress: 0.7, // 70% quality
                  format: ImageManipulator.SaveFormat.JPEG 
                }
              );
              
              console.log(`Compressed image ${i + 1}: ${compressedImage.uri}`);
              
              const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
                encoding: 'base64',
              });
              base64Images.push(`data:image/jpeg;base64,${base64}`);
            } else {
              base64Images.push(imageUri);
            }
          }
          postImages = base64Images;
          console.log(`Successfully processed ${base64Images.length} images`);
        } catch (error) {
          console.error('Error converting multiple images to base64:', error);
          Alert.alert('Error', 'Failed to process images. Please try again.');
          return;
        }
      } else if (selectedImage) {
        // Fallback to single image for backward compatibility
        if (selectedImage.startsWith('file://')) {
          try {
            // Compress the image first
            const compressedImage = await ImageManipulator.manipulateAsync(
              selectedImage,
              [
                { resize: { width: 800 } }, // Resize to max width of 800px
              ],
              { 
                compress: 0.7, // 70% quality
                format: ImageManipulator.SaveFormat.JPEG 
              }
            );
            
            // Convert compressed image to base64
            const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
              encoding: 'base64',
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
      
      console.log('Post type detected:', postType);

      if (postType === 'forum') {
        // Use forum API for forum posts
        const forumData = {
          title: '', // Forum posts don't require title
          content: postContent.trim(),
          images: postImages.length > 0 ? postImages : (postImage ? [postImage] : undefined), // Use multiple images
        };
        console.log('Submitting forum post data:', forumData);
        await createForumPost(forumData);
      } else {
        // Use regular post API for all other posts
        const postData = {
          post_content: postContent.trim(),
          post_image: postImage, // Backward compatibility
          post_images: postImages.length > 0 ? postImages : undefined, // Multiple images
          type: postType,
        };
        console.log('Submitting regular post data:', postData);
        console.log('Post image data:', postImage ? 'Present' : 'Not present');
        console.log('Post images data:', postImages.length > 0 ? `${postImages.length} images` : 'No images');
        await createPost(postData);
      }
      
      console.log('Post created successfully!');
      Alert.alert('Success', 'Post created successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create post. Please try again.';
      let errorTitle = 'Error';
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('ECONNABORTED')) {
          errorTitle = 'Upload Timeout';
          errorMessage = 'The upload timed out. This might be due to large images or slow connection. Please try with fewer or smaller images.';
        } else if (error.message.includes('Network Error') || error.message.includes('ERR_NETWORK')) {
          errorTitle = 'Network Error';
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('413') || error.message.includes('too large')) {
          errorTitle = 'File Too Large';
          errorMessage = 'Images are too large. Please try with smaller images or fewer images.';
        } else if (error.message.includes('Invalid image format')) {
          errorTitle = 'Invalid Image';
          errorMessage = 'One or more images are in an unsupported format. Please try with different images.';
        } else if (error.message.includes('Upload timeout')) {
          errorTitle = 'Upload Timeout';
          errorMessage = error.message;
        }
      }
      
      Alert.alert(errorTitle, errorMessage, [
        { text: 'OK', style: 'default' },
        { text: 'Try Again', onPress: () => handleSubmit() }
      ]);
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
          <UserAvatar 
            profilePic={user?.profile_pic}
            firstName={user?.f_name}
            lastName={user?.l_name}
            size={40}
            style={styles.avatar}
          />
          <Text style={styles.userName}>{userName}</Text>
        </View>



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
          <TouchableOpacity 
            style={styles.addImageRow} 
            onPress={() => {
              console.log('Image button pressed!');
              pickImage();
            }}
          >
            <FontAwesome name="image" size={32} color="#4B944D" style={styles.addImageIcon} />
            <Text style={styles.addImageText}>
              {selectedImages.length > 0 ? `${selectedImages.length} Image${selectedImages.length > 1 ? 's' : ''} Selected` : 'Add Image(s)'}
            </Text>
          </TouchableOpacity>
          
          {/* Display multiple selected images */}
          {selectedImages.length > 0 && (
            <ScrollView horizontal style={styles.imagesContainer}>
              {selectedImages.map((image, index) => (
                <View key={index} style={styles.selectedImageContainer}>
                  <Image source={{ uri: image }} style={styles.selectedImage} />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          
          {/* Fallback for single image (backward compatibility) */}
          {selectedImages.length === 0 && selectedImage && (
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
  imagesContainer: {
    marginTop: 10,
    maxHeight: 150,
  },

});



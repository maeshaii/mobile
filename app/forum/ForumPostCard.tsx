import React, { useState, useEffect, useRef } from 'react';

import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ScrollView, ActivityIndicator, Dimensions } from 'react-native';

import { FontAwesome } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import dayjs from 'dayjs';

import { API_BASE_URL, likeForumPost, unlikeForumPost, repostForumPost, deleteForumPost, editForumPost, commentOnForumPost } from '../../services/api';

import UserAvatar from '../../components/UserAvatar';

import { getImagesFromContent, getFirstImageUrl, hasImages } from '../../utils/imageUtils';

import { renderTextWithMentions } from '../../utils/mentionUtils';
import { formatUserFullName, formatLikeCountText } from '../../utils/nameUtils';



interface Post {

  post_id: number;

  post_title?: string;

  post_content: string;

  post_image?: string | null;

  post_images?: any[];

  type?: string | null;

  created_at?: string | null;

  likes?: any[];

  comments?: any[];

  reposts?: any[];

  likes_count: number;

  comments_count: number;

  reposts_count?: number;

  is_liked?: boolean;

  user: { 

    user_id: number; 

    f_name: string; 

    m_name?: string | null;

    l_name: string; 

    profile_pic?: string | null;

    account_type?: string;

    user_type?: string;

  };

}



interface Props {

  post: Post;

  currentUserId?: number;

  onLikeToggle?: (postId: number, isLiked: boolean) => void;

  onOpenViewer?: (post: Post, type: 'likes' | 'comments' | 'reposts') => void;

  onEdited?: (postId: number, newContent: string) => void;

  onDeleted?: (postId: number) => void;

  onRepostToggle?: (postId: number, isReposted: boolean) => void;

}



const ForumPostCard: React.FC<Props> = ({ post, currentUserId, onLikeToggle, onOpenViewer, onEdited, onDeleted, onRepostToggle }) => {

  const router = useRouter();



  // Local state

  const [isLiked, setIsLiked] = useState(post.is_liked || false);

  const [likeCount, setLikeCount] = useState(post.likes_count || 0);

  const [repostCount, setRepostCount] = useState(post.reposts_count || 0);

  const [commentCount, setCommentCount] = useState(post.comments_count || 0);

  const [showActions, setShowActions] = useState(false);

  const [editModal, setEditModal] = useState(false);

  const [editContent, setEditContent] = useState(post.post_content);

  const [editLoading, setEditLoading] = useState(false);

  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const imageScrollRef = useRef<ScrollView>(null);



  const userName = formatUserFullName(post.user);

  const isPriorityUser = post.user?.account_type === 'admin' || post.user?.account_type === 'peso' || 

                        post.user?.user_type === 'admin' || post.user?.user_type === 'peso';

  const isAdmin = post.user?.account_type === 'admin' || post.user?.user_type === 'admin';



  // Use centralized image utility with deduplication
  const images = getImagesFromContent(post);

  const imageUrl = images.length > 0 ? (String(images[0].image_url).startsWith('http') ? images[0].image_url : `${API_BASE_URL}${images[0].image_url}`) : '';

  const hasPostImages = images.length > 0;



  // Sync like state when post data changes

  useEffect(() => {
    let liked: any = post.is_liked;
    if ((liked === undefined || liked === null) && currentUserId && Array.isArray((post as any).likes)) {
      liked = (post as any).likes.some((l: any) => (l?.user_id || l?.user?.user_id) === currentUserId);
    }
    setIsLiked(Boolean(liked));

    setLikeCount(post.likes_count || 0);

    setRepostCount(post.reposts_count || 0);

    setCommentCount(post.comments_count || 0);

  }, [post.is_liked, post.likes_count, post.reposts_count, post.comments_count, (post as any).likes, currentUserId]);



  const handleLike = async () => {

    try {

      if (isLiked) {

        await unlikeForumPost(post.post_id);

        setIsLiked(false);

        setLikeCount((c) => Math.max(0, c - 1));

        onLikeToggle?.(post.post_id, false);

      } else {

        await likeForumPost(post.post_id);

        setIsLiked(true);

        setLikeCount((c) => c + 1);

        onLikeToggle?.(post.post_id, true);

      }

    } catch (error) {

      Alert.alert('Error', 'Failed to update like.');

    }

  };



  const handleRepost = () => {

    console.log('ForumPostCard - post:', post);

    

    // Validate post ID

    if (!post.post_id) {

      Alert.alert('Error', 'Invalid post ID. Cannot repost this post.');

      return;

    }



    // Check if current user already reposted this post

    const meId = currentUserId;

    const alreadyReposted = Array.isArray(post.reposts) 

      ? post.reposts.find((r: any) => r.user?.user_id === meId)

      : null;

    

    console.log('ForumPostCard - alreadyReposted:', alreadyReposted);

    

    if (alreadyReposted) {

      Alert.alert(

        'Already Reposted',

        'You have already reposted this post. Would you like to edit your repost?',

        [

          { text: 'Cancel', style: 'cancel' },

          { 

            text: 'Edit Repost', 

            onPress: () => {

              console.log('ForumPostCard - Navigating to repost screen for edit with postId:', post.post_id);

              router.push(`/repost/repost?postId=${post.post_id}&isForumPost=true`);

              // Note: Repost count will be updated when the user returns to this screen

            }

          }

        ]

      );

    } else {

      // Navigate to repost screen so user can add an optional caption

      console.log('ForumPostCard - Navigating to repost screen with postId:', post.post_id);

      router.push(`/repost/repost?postId=${post.post_id}&isForumPost=true`);

      // Note: Repost count will be updated when the user returns to this screen

    }

  };



  const handleDelete = async () => {

    setShowActions(false);

    Alert.alert(

      'Delete Post',

      'Are you sure you want to delete this post?',

      [

        { text: 'Cancel', style: 'cancel' },

        {

          text: 'Delete',

          style: 'destructive',

          onPress: async () => {

            try {

              const response = await deleteForumPost(post.post_id);

              if (response.success !== false) {

                Alert.alert('Success', 'Post deleted successfully.');

                onDeleted?.(post.post_id);

              } else {

                Alert.alert('Error', response.message || 'Failed to delete post.');

              }

            } catch (error: any) {

              Alert.alert('Error', error?.response?.data?.error || error?.message || 'Could not delete post.');

            }

          }

        }

      ]

    );

  };



  const handleEdit = async () => {

    if (!editContent.trim()) {

      Alert.alert('Error', 'Post content cannot be empty.');

      return;

    }



    setEditLoading(true);

    try {

      const response = await editForumPost(post.post_id, { post_content: editContent.trim() });

      if (response.success !== false) {

        Alert.alert('Success', 'Post updated successfully.');

        setEditModal(false);

        onEdited?.(post.post_id, editContent.trim());

      } else {

        Alert.alert('Error', response.message || 'Failed to update post.');

      }

    } catch (error: any) {

      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Could not update post.');

    } finally {

      setEditLoading(false);

    }

  };



  return (

    <>

      <View style={styles.card}>

        {/* Header */}

        <View style={styles.cardHeader}>

          <TouchableOpacity

            onPress={() => {

              const uid = post.user?.user_id;

              if (uid) {

                router.push(`/profile/profilepage?viewUserId=${uid}`);

              }

            }}

            disabled={!post.user?.user_id}

            style={styles.userContainer}

          >

            <UserAvatar 

              profilePic={post.user?.profile_pic}

              firstName={post.user?.f_name}

              lastName={post.user?.l_name}

              size={40}

              style={styles.avatar}

            />

            <View style={{ flex: 1 }}>

              <View style={styles.nameContainer}>

                <Text style={[

                  styles.name,

                  (post.user?.user_id && post.user?.user_id !== currentUserId) ? styles.clickableName : null

                ]}>{userName}</Text>

                {isPriorityUser && (

                  <View style={[

                    styles.priorityBadge,

                    isAdmin ? styles.adminBadge : styles.pesoBadge

                  ]}>

                    <Text style={styles.priorityBadgeText}>

                      {isAdmin ? 'ADMIN' : 'PESO'}

                    </Text>

                  </View>

                )}

              </View>

              <Text style={styles.meta}>{dayjs(post.created_at).fromNow()}</Text>

            </View>

          </TouchableOpacity>

          {currentUserId === post.user?.user_id && (

            <TouchableOpacity

              onPress={() => setShowActions(true)}

              style={{ padding: 6 }}

              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}

            >

              <FontAwesome name="ellipsis-h" size={18} color="#888" />

            </TouchableOpacity>

          )}

        </View>



        {/* Content */}

        {post.post_title && <Text style={styles.postTitle}>{post.post_title}</Text>}

        <Text style={styles.content}>

          {renderTextWithMentions(post.post_content, [], (userId) => {

            router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });

          })}

        </Text>



        {/* Images - Facebook-style grid layout like web */}

        {hasPostImages && (

          <View style={styles.imagesContainer}>

            {images.length === 1 ? (

              // Single image - full width

              <TouchableOpacity 

                onPress={() => {

                  setSelectedImageIndex(0);

                  setImageViewerVisible(true);

                }}

              >

                <Image 

                  source={{ uri: imageUrl || '' }} 

                  style={styles.singleImage} 

                  resizeMode="contain" 

                />

              </TouchableOpacity>

            ) : (

              // Multiple images - Facebook-style grid layout

              <View style={styles.imagesGrid}>

                {images.slice(0, 4).map((image, index) => {

                  // Determine grid style based on image count and position

                  let gridStyle = styles.gridImageContainer;

                  if (images.length === 2) {

                    gridStyle = styles.twoImagesGrid;

                  } else if (images.length === 3) {

                    gridStyle = index === 0 ? styles.threeImagesFirst : styles.threeImagesRest;

                  } else if (images.length === 4) {

                    gridStyle = styles.fourImagesGrid;

                  } else if (images.length >= 5) {

                    gridStyle = styles.fourImagesGrid;

                  }

                  

                  return (

                    <TouchableOpacity 

                      key={index}

                      style={[gridStyle, { marginBottom: 2 }]}

                      onPress={() => {

                        setSelectedImageIndex(index);

                        setImageViewerVisible(true);

                      }}

                    >

                    <Image 

                      source={{ uri: String(image.image_url).startsWith('http') ? image.image_url : `${API_BASE_URL}${image.image_url}` }} 

                      style={styles.gridImage} 

                      resizeMode="cover" 

                    />

                    {/* Show "+X more" overlay for the 4th image if there are more than 4 */}

                    {index === 3 && images.length > 4 && (

                      <View style={styles.moreImagesOverlay}>

                        <Text style={styles.moreImagesText}>+{images.length - 4}</Text>

                      </View>

                    )}

                  </TouchableOpacity>

                  );

                })}

              </View>

            )}

          </View>

        )}



        {/* Stats */}

        <View style={styles.actionsCountsRow}>

          {likeCount > 0 && (
            <TouchableOpacity onPress={() => onOpenViewer?.(post, 'likes')}>

              <Text style={styles.countText}>
                {formatLikeCountText((post as any).likes, likeCount)}
              </Text>

            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => onOpenViewer?.(post, 'comments')}>

            <Text style={styles.countText}>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</Text>

          </TouchableOpacity>

          <TouchableOpacity onPress={() => onOpenViewer?.(post, 'reposts')}>

            <Text style={styles.countText}>{repostCount} {repostCount === 1 ? 'repost' : 'reposts'}</Text>

          </TouchableOpacity>

        </View>



        {/* Actions */}

        <View style={styles.actions}>

          <TouchableOpacity style={styles.actionIcon} onPress={handleLike}>

            <FontAwesome

              name={isLiked ? 'thumbs-up' : 'thumbs-o-up'}

              size={18}

              color={isLiked ? '#1e3a8a' : '#555'}

            />

            <Text style={[styles.actionText, isLiked && styles.likedText]}>Like</Text>

          </TouchableOpacity>



          <TouchableOpacity style={styles.actionIcon} onPress={() => onOpenViewer?.(post, 'comments')}>

            <FontAwesome name="comment-o" size={18} color="#555" />

            <Text style={styles.actionText}>Comment</Text>

          </TouchableOpacity>



          <TouchableOpacity style={styles.actionIcon} onPress={handleRepost}>

            <FontAwesome name="retweet" size={18} color="#555" />

            <Text style={styles.actionText}>Repost</Text>

          </TouchableOpacity>

        </View>

      </View>



      {/* Action Sheet Modal */}

      <Modal visible={showActions} transparent animationType="fade">

        <TouchableOpacity

          style={styles.modalOverlay}

          activeOpacity={1}

          onPressOut={() => setShowActions(false)}

        >

          <View style={styles.sheet}>

            <TouchableOpacity

              style={styles.sheetRow}

              onPress={() => {

                setEditModal(true);

                setShowActions(false);

              }}

            >

              <FontAwesome name="pencil" size={18} color="#374151" style={{ marginRight: 8 }} />

              <Text style={styles.sheetRowText}>Edit Post</Text>

            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity

              style={styles.sheetRow}

              onPress={() => {

                setShowActions(false);

                handleDelete();

              }}

            >

              <FontAwesome name="trash" size={18} color="#dc2626" style={{ marginRight: 8 }} />

              <Text style={[styles.sheetRowText, { color: '#dc2626' }]}>Delete Post</Text>

            </TouchableOpacity>

          </View>

          <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowActions(false)}>

            <Text style={styles.sheetCancelText}>Cancel</Text>

          </TouchableOpacity>

        </TouchableOpacity>

      </Modal>



      {/* Edit Modal */}

      <Modal visible={editModal} transparent animationType="slide">

        <View style={styles.modalOverlay}>

          <View style={styles.editModalContent}>

            <View style={styles.editModalHeader}>

              <TouchableOpacity onPress={() => setEditModal(false)} style={styles.editModalCloseButton}>

                <FontAwesome name="times" size={20} color="#666" />

              </TouchableOpacity>

              <Text style={styles.editModalTitle}>Edit Post</Text>

              <TouchableOpacity 

                onPress={handleEdit}

                disabled={editLoading}

                style={[styles.editModalSaveButton, editLoading && styles.editModalSaveButtonDisabled]}

              >

                {editLoading ? (

                  <ActivityIndicator size="small" color="#fff" />

                ) : (

                  <Text style={styles.editModalSaveText}>Save</Text>

                )}

              </TouchableOpacity>

            </View>

            <TextInput

              style={styles.editModalInput}

              value={editContent}

              onChangeText={setEditContent}

              placeholder="What's on your mind?"

              multiline

              numberOfLines={4}

            />

          </View>

        </View>

      </Modal>



      {/* Image Viewer Modal */}
      <Modal visible={imageViewerVisible} transparent animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity 
            style={styles.imageViewerCloseButton}
            onPress={() => setImageViewerVisible(false)}
          >
            <FontAwesome name="times" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.imageViewerContainer}>
            <ScrollView
              ref={imageScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
              nestedScrollEnabled
              keyboardShouldPersistTaps="always"
              style={{ flex: 1, width: '100%' }}
              contentOffset={{ x: selectedImageIndex * screenWidth, y: 0 }}
              onLayout={() => {
                if (imageScrollRef.current) {
                  imageScrollRef.current.scrollTo({ x: selectedImageIndex * screenWidth, y: 0, animated: false });
                }
              }}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setSelectedImageIndex(index);
              }}
            >
              {images.map((img, idx) => (
                <View key={idx} style={{ width: screenWidth, height: screenHeight, justifyContent: 'center', alignItems: 'center' }}>
                  <Image
                    source={{ uri: String(img.image_url).startsWith('http') ? img.image_url : `${API_BASE_URL}${img.image_url}` }}
                    style={{ width: screenWidth, height: screenHeight * 0.8 }}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>

  );

};



export default ForumPostCard;



const styles = StyleSheet.create({

  card: {

    backgroundColor: '#fff',

    padding: 15,

    marginBottom: 10,

    borderRadius: 12,

    shadowColor: '#000',

    shadowOpacity: 0.1,

    shadowRadius: 4,

    shadowOffset: { width: 0, height: 2 },

    elevation: 3,

  },

  cardHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 10,

  },

  userContainer: {

    flexDirection: 'row',

    alignItems: 'center',

    flex: 1,

  },

  avatar: {

    width: 40,

    height: 40,

    borderRadius: 20,

    marginRight: 10,

    backgroundColor: '#ccc',

  },

  nameContainer: {

    flexDirection: 'row',

    alignItems: 'center',

    flex: 1,

  },

  name: {

    fontSize: 16,

    fontWeight: 'bold',

    color: '#333',

  },

  clickableName: {

    color: '#1e3a8a',

  },

  priorityBadge: {

    paddingHorizontal: 6,

    paddingVertical: 2,

    borderRadius: 4,

    marginLeft: 8,

  },

  adminBadge: {

    backgroundColor: '#dc2626',

  },

  pesoBadge: {

    backgroundColor: '#059669',

  },

  priorityBadgeText: {

    color: '#fff',

    fontSize: 10,

    fontWeight: 'bold',

  },

  meta: {

    fontSize: 12,

    color: '#666',

    marginTop: 2,

  },

  postTitle: {

    fontSize: 18,

    fontWeight: 'bold',

    marginBottom: 8,

    color: '#333',

  },

  content: {

    fontSize: 14,

    lineHeight: 20,

    color: '#333',

    marginBottom: 10,

  },

  imagesContainer: {

    marginTop: 10,

    borderRadius: 8,

    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',

  },

  singleImage: {

    width: '100%',

    height: 300,

    borderRadius: 8,
    alignSelf: 'center',

  },

  imagesGrid: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 2,

    justifyContent: 'space-between',

  },

  // Facebook-style grid layouts

  twoImagesGrid: {

    width: '49%',

    height: 200,

    position: 'relative',

    overflow: 'hidden',

    borderRadius: 4,

  },

  threeImagesGrid: {

    // Container style - individual images have their own styles

  },

  fourImagesGrid: {

    width: '49%',

    height: 150,

    position: 'relative',

    overflow: 'hidden',

    borderRadius: 4,

  },

  fivePlusImagesGrid: {

    width: '49%',

    height: 120,

    position: 'relative',

    overflow: 'hidden',

    borderRadius: 4,

  },

  gridImageContainer: {

    position: 'relative',

    overflow: 'hidden',

    borderRadius: 4,

  },

  threeImagesFirst: {

    width: '49%',

    height: 200,

    position: 'relative',

    overflow: 'hidden',

    borderRadius: 4,

  },

  threeImagesRest: {

    width: '49%',

    height: 100,

    position: 'relative',

    overflow: 'hidden',

    borderRadius: 4,

  },

  gridImage: {

    width: '100%',

    height: '100%',

    minHeight: 100,

  },

  moreImagesOverlay: {

    position: 'absolute',

    top: 0,

    left: 0,

    right: 0,

    bottom: 0,

    backgroundColor: 'rgba(0, 0, 0, 0.75)',

    justifyContent: 'center',

    alignItems: 'center',

  },

  moreImagesText: {

    color: 'white',

    fontSize: 20,

    fontWeight: 'bold',

  },

  actionsCountsRow: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    paddingHorizontal: 8,

    marginTop: 8,

    marginBottom: 8,

  },

  countText: {

    fontSize: 12,

    color: '#666',

  },

  actions: {

    flexDirection: 'row',

    justifyContent: 'space-around',

    marginTop: 15,

    borderTopWidth: 1,

    borderTopColor: '#eee',

    paddingTop: 10,

  },

  actionIcon: {

    alignItems: 'center',

    gap: 2,

  },

  actionText: {

    fontSize: 12,

    color: '#555',

  },

  likedText: {

    color: '#1e3a8a',

    fontWeight: 'bold',

  },

  modalOverlay: {

    flex: 1,

    backgroundColor: 'rgba(0,0,0,0.5)',

    justifyContent: 'center',

    alignItems: 'center',

  },

  modalContent: {

    backgroundColor: '#fff',

    width: '90%',

    borderRadius: 12,

    padding: 20,

  },

  modalButton: {

    padding: 12,

    borderRadius: 8,

    marginVertical: 6,

    backgroundColor: '#1e3a8a',

  },

  modalButtonText: {

    color: '#fff',

    textAlign: 'center',

    fontWeight: 'bold',

  },

  // Action Sheet styles (matching RepostCard design)

  sheet: {

    backgroundColor: '#fff',

    width: '88%',

    borderRadius: 16,

    paddingVertical: 8,

  },

  sheetRow: {

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 16,

    paddingVertical: 14,

  },

  sheetRowText: {

    fontSize: 16,

    color: '#111827',

  },

  sheetDivider: {

    height: 1,

    backgroundColor: '#e5e7eb',

  },

  sheetCancel: {

    marginTop: 10,

    backgroundColor: '#fff',

    borderRadius: 16,

    width: '88%',

    paddingVertical: 14,

    alignItems: 'center',

  },

  sheetCancelText: {

    fontSize: 16,

    color: '#6b7280',

    fontWeight: '500',

  },

  editModalContent: {

    backgroundColor: '#fff',

    width: '90%',

    borderRadius: 16,

    padding: 0,

    maxHeight: '80%',

  },

  editModalHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingHorizontal: 16,

    paddingVertical: 12,

    borderBottomWidth: 1,

    borderBottomColor: '#e5e7eb',

  },

  editModalCloseButton: {

    padding: 8,

    borderRadius: 20,

    backgroundColor: '#f3f4f6',

  },

  editModalTitle: {

    fontSize: 18,

    fontWeight: '700',

    color: '#111827',

  },

  editModalSaveButton: {

    backgroundColor: '#1e3a8a',

    paddingHorizontal: 16,

    paddingVertical: 8,

    borderRadius: 20,

  },

  editModalSaveButtonDisabled: {

    backgroundColor: '#9ca3af',

  },

  editModalSaveText: {

    color: '#fff',

    fontWeight: '600',

    fontSize: 14,

  },

  editModalInput: {

    padding: 16,

    fontSize: 16,

    color: '#111827',

    minHeight: 120,

    textAlignVertical: 'top',

  },

  imageViewerOverlay: {

    flex: 1,

    backgroundColor: 'rgba(0,0,0,0.9)',

    justifyContent: 'center',

    alignItems: 'center',

  },

  imageViewerCloseButton: {

    position: 'absolute',

    top: 60,

    right: 20,

    zIndex: 1,

    backgroundColor: 'rgba(0,0,0,0.7)',

    padding: 12,

    borderRadius: 25,

  },

  imageViewerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  imageViewerImage: {

    width: '100%',

    height: '100%',

  },

  imageNavButton: {

    position: 'absolute',

    top: '50%',

    transform: [{ translateY: -20 }],

    backgroundColor: 'rgba(0,0,0,0.7)',

    padding: 12,

    borderRadius: 25,

  },

  imageNavLeft: {

    left: 20,

  },

  imageNavRight: {

    right: 20,

  },

});


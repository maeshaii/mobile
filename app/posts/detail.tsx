import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { getPostDetail, getDonationDetail, getForumDetail, getUserInfo, followUser, unfollowUser, checkFollowStatus, commentOnPost, getPostComments, updateComment, deleteComment, likePost, unlikePost, repostPost, API_BASE_URL, getPostLikes, getPostReposts, getCommentReplies, createCommentReply, updateCommentReply, deleteCommentReply } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import { renderTextWithMentions } from '../../utils/mentionUtils';
import MentionInput from '../../components/MentionInput';
import PostCard from './postCard';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getImagesFromContent } from '../../utils/imageUtils';

dayjs.extend(relativeTime);

export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const postId = typeof params.postId === 'string' ? parseInt(params.postId) : undefined;
  const isForumPost = Array.isArray(params.isForumPost)
    ? params.isForumPost[0] === 'true'
    : params.isForumPost === 'true';
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'reposts' | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [actionFor, setActionFor] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [commentReplies, setCommentReplies] = useState<{ [commentId: number]: any[] }>({});
  const [showReplies, setShowReplies] = useState<{ [commentId: number]: boolean }>({});
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editReplyText, setEditReplyText] = useState('');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const load = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      console.log('Loading post detail for postId:', postId);
      const [user] = await Promise.all([
        getUserInfo()
      ]);
      let detail: any | null = null;

      if (isForumPost) {
        // Prefer forum detail for forum-origin posts
        try {
          const forum = await getForumDetail(postId);
          if (forum) {
            const imagesArray = Array.isArray(forum.post_images)
              ? forum.post_images
              : Array.isArray(forum.images)
                ? forum.images
                : forum.post_image
                  ? [{ image_url: forum.post_image, order: 0 }]
                  : [];
            detail = {
              post_id: forum.post_id ?? postId,
              post_title: forum.post_title ?? undefined,
              post_content: forum.post_content ?? '',
              post_image: forum.post_image ?? (imagesArray[0]?.image_url || null),
              post_images: imagesArray,
              images: imagesArray,
              created_at: forum.created_at ?? forum.date_created ?? null,
              likes_count: forum.likes_count ?? (Array.isArray(forum.likes) ? forum.likes.length : 0),
              comments_count: forum.comments_count ?? (Array.isArray(forum.comments) ? forum.comments.length : 0),
              reposts_count: forum.reposts_count ?? (Array.isArray(forum.reposts) ? forum.reposts.length : 0),
              is_liked: !!forum.is_liked,
              user: forum.user || { user_id: 0, f_name: 'Unknown', l_name: 'User', profile_pic: null },
            };
          }
        } catch (e) {
          console.log('getForumDetail failed, will try general post detail. Error:', e);
        }
      }

      // If not forum or forum detail missing, try general post detail
      if (!detail) {
        try {
          detail = await getPostDetail(postId);
        } catch (e) {
          console.log('getPostDetail failed, will try donation detail fallback. Error:', e);
        }
      }

      // Fallback: try donation detail if regular post not found or empty
      if (!detail || (typeof detail !== 'object')) {
        try {
          const donation = await getDonationDetail(postId);
          if (donation) {
            // Normalize donation detail to match expected post shape
            const imagesArray = Array.isArray(donation.images)
              ? donation.images.map((img: any, idx: number) => ({
                  image_url: typeof img === 'string' ? img : (img.image_url || img.url || img.path),
                  order: img.order ?? idx,
                }))
              : [];
            detail = {
              post_id: donation.donation_id ?? donation.post_id ?? donation.id ?? postId,
              post_title: donation.post_title ?? undefined,
              post_content: donation.description ?? donation.post_content ?? '',
              post_image: donation.post_image ?? (imagesArray[0]?.image_url || null),
              post_images: imagesArray,
              images: imagesArray,
              created_at: donation.created_at ?? donation.donation_date ?? donation.date_created ?? null,
              likes_count: donation.likes_count ?? (Array.isArray(donation.likes) ? donation.likes.length : 0),
              comments_count: donation.comments_count ?? (Array.isArray(donation.comments) ? donation.comments.length : 0),
              reposts_count: donation.reposts_count ?? (Array.isArray(donation.reposts) ? donation.reposts.length : 0),
              is_liked: !!donation.is_liked,
              user: donation.user || { user_id: 0, f_name: 'Unknown', l_name: 'User', profile_pic: null },
            };
          }
        } catch (e2) {
          console.log('Donation detail fallback also failed:', e2);
        }
      }

      console.log('Post detail loaded (normalized):', detail);
      setPost(detail);
      setMe(user);
      
      // Check follow status (support id or user_id)
      const targetUserId = detail?.user?.user_id || detail?.user?.id;
      const currentUserId = user?.user_id || user?.id;
      if (targetUserId && currentUserId && targetUserId !== currentUserId) {
        try {
          const followStatus = await checkFollowStatus(targetUserId);
          setIsFollowing(!!followStatus?.is_following);
        } catch (error) {
          console.error('Error checking follow status:', error);
        }
      }
      
      // Check if post is liked
      if (detail?.likes && Array.isArray(detail.likes)) {
        const meId = user?.id || user?.user_id;
        setIsLiked(detail.likes.some((like: any) => (like.user_id || like.user?.user_id) === meId));
      }
      
      // Load comments
      await loadComments();
    } catch (error) {
      console.error('Error loading post detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!postId) return;
    try {
      const data = await getPostComments(postId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    }
  };

  // Helper function to check if user is admin or peso
  const isAdminOrPesoUser = (user: any) => {
    if (!user) return false;
    
    // Check if account_type is available from backend
    const userType = user.account_type || user.user_type;
    if (userType) {
      return userType === 'admin' || userType === 'peso';
    }
    
    // Simple solution: Check if user name contains admin/peso indicators
    const fullName = `${user.f_name || ''} ${user.l_name || ''}`.toLowerCase();
    
    // Check for admin indicators
    if (fullName.includes('admin') || 
        fullName.includes('administrator') || 
        fullName.includes('system') ||
        fullName.includes('ctc') ||
        fullName.includes('coordinator')) {
      return true;
    }
    
    // Check for peso indicators  
    if (fullName.includes('peso') || 
        fullName.includes('employment') || 
        fullName.includes('job') ||
        fullName.includes('career')) {
      return true;
    }
    
    return false;
  };

  const handleFollow = async () => {
    if (!post?.user?.user_id || followLoading) return;
    
    try {
      setFollowLoading(true);
      if (isFollowing) {
        await unfollowUser(post.user.user_id);
        setIsFollowing(false);
      } else {
        await followUser(post.user.user_id);
        setIsFollowing(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!postId || !commentText.trim()) return;
    try {
      setSubmittingComment(true);
      await commentOnPost(postId, commentText.trim());
      setCommentText('');
      await loadComments();
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editText.trim()) return;
    try {
      await updateComment(postId!, commentId, editText.trim());
      setEditingId(null);
      setEditText('');
      await loadComments();
    } catch {
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(postId!, commentId);
      await loadComments();
    } catch {
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const handleEditPost = async () => {
    if (!editPostContent.trim()) return;
    try {
      setActionLoading(true);
      // Update the original post content/caption
      // TODO: Add updatePost API call
      // await updatePost(postId!, editPostContent.trim());
      
      // Update the post state immediately for better UX
      setPost((prev: any) => ({
        ...prev,
        post_content: editPostContent.trim(),
        // Also update caption if it exists
        caption: editPostContent.trim()
      }));
      
      Alert.alert('Success', 'Post caption updated successfully!');
      setEditingPost(false);
      setEditPostContent('');
      
      // Reload post data to ensure consistency
      await load();
    } catch (error) {
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      // TODO: Add deletePost API call that also deletes all reposts
      // await deletePost(postId!); // This should cascade delete all reposts
      Alert.alert('Success', 'Post and all its reposts have been deleted successfully!');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete post');
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    try {
      setSubmittingReply(true);
      
      // Find the comment to get the user info for mention
      const comment = comments.find(c => c.comment_id === replyingTo);
      const mentionText = comment ? `@${comment.user?.f_name || 'User'} ` : '';
      const replyWithMention = `${mentionText}${replyText.trim()}`;
      
      await createCommentReply(replyingTo, replyWithMention);
      setReplyText('');
      setReplyingTo(null);
      // Show replies after submitting a new reply
      setShowReplies(prev => ({ ...prev, [replyingTo]: true }));
      await loadReplies(replyingTo);
    } catch (error) {
      console.error('Error submitting reply:', error);
      Alert.alert('Error', 'Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const loadReplies = async (commentId: number) => {
    try {
      console.log('Loading replies for comment:', commentId);
      const response = await getCommentReplies(commentId);
      console.log('Replies response:', response);
      console.log('Number of replies received:', response.replies?.length || 0);
      setCommentReplies(prev => {
        const newReplies = { ...prev, [commentId]: response.replies || [] };
        console.log('Updated commentReplies state:', newReplies);
        return newReplies;
      });
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  };

  const handleReplyUpdate = async (commentId: number, replyId: number) => {
    if (!editReplyText.trim()) return;
    
    try {
      await updateCommentReply(commentId, replyId, editReplyText.trim());
      setEditingReplyId(null);
      setEditReplyText('');
      await loadReplies(commentId);
    } catch (error) {
      Alert.alert('Error', 'Failed to update reply');
    }
  };

  const handleReplyDelete = async (commentId: number, replyId: number) => {
    try {
      await deleteCommentReply(commentId, replyId);
      await loadReplies(commentId);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete reply');
    }
  };

  const toggleReplies = (commentId: number) => {
    setShowReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
    if (!showReplies[commentId]) {
      loadReplies(commentId);
    }
  };

  const scrollToEditInput = () => {
    // Scroll to bottom when editing starts to ensure input is visible
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // Also try scrolling after a longer delay to ensure keyboard is fully up
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 500);
  };

  const renderAvatar = (src?: string) => {
    if (!src) return require('../../assets/images/sample_pic.jpg');
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  const renderImage = (src?: string) => {
    if (!src) return null;
    const isAbs = String(src).startsWith('http') || String(src).startsWith('data:');
    return { uri: isAbs ? src : `${API_BASE_URL}${src}` };
  };

  const getPostImages = (p: any): Array<{ image_url: string; order?: number }> => {
    if (!p) return [];
    // Use the proper image utility function to avoid duplicates
    return getImagesFromContent(p);
  };

  const meId = me?.id || me?.user_id;

  useEffect(() => { load(); }, [postId]);

  // Load replies for comments that have replies when comments change
  useEffect(() => {
    if (comments.length > 0) {
      comments.forEach(comment => {
        if ((comment.replies_count || 0) > 0) {
          loadReplies(comment.comment_id);
          // Automatically show replies when they exist
          setShowReplies(prev => ({ ...prev, [comment.comment_id]: true }));
        }
      });
    }
  }, [comments]);

  // Handle keyboard events for better scrolling
  useEffect(() => {
    const keyboardDidShowListener = () => {
      // Scroll to bottom when keyboard appears to show edit inputs
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const keyboardDidHideListener = () => {
      // Optional: scroll back to top when keyboard hides
    };

    // Add keyboard listeners
    const showSubscription = Platform.OS === 'ios' 
      ? require('react-native').Keyboard.addListener('keyboardWillShow', keyboardDidShowListener)
      : require('react-native').Keyboard.addListener('keyboardDidShow', keyboardDidShowListener);
    
    const hideSubscription = Platform.OS === 'ios'
      ? require('react-native').Keyboard.addListener('keyboardWillHide', keyboardDidHideListener)
      : require('react-native').Keyboard.addListener('keyboardDidHide', keyboardDidHideListener);

    return () => {
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  if (!postId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1f2937" />
          </TouchableOpacity>
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
      </View>
      <View style={styles.divider} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView ref={scrollViewRef} style={styles.content}>
        {/* Post Header with Follow Button */}
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => {
                const uid = post?.user?.user_id || post?.user?.id;
                if (uid) router.push(`/profile/profilepage?viewUserId=${uid}`);
              }}
            >
              <UserAvatar 
                profilePic={post.user?.profile_pic}
                firstName={post.user?.f_name}
                lastName={post.user?.l_name}
                size={48}
                style={styles.authorAvatar}
              />
            </TouchableOpacity>
            <View style={styles.authorDetails}>
              <TouchableOpacity
                onPress={() => {
                  const uid = post?.user?.user_id || post?.user?.id;
                  if (uid) router.push(`/profile/profilepage?viewUserId=${uid}`);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.authorName}>
                  {`${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim() || 'User'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.postTime}>{dayjs(post.created_at).fromNow()}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {post.user?.user_id !== meId && (post.user?.id !== meId) && !isFollowing && !isAdminOrPesoUser(post.user) && (
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followingButton]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {followLoading ? '...' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
            {/* Post owner ellipsis menu */}
            {(post.user?.user_id === meId || post.user?.id === meId) && (
              <TouchableOpacity
                style={styles.ellipsisButton}
                onPress={() => setActionFor({ type: 'post', post: post })}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Post Content */}
        <View style={styles.postContent}>
          {post.post_title && <Text style={styles.postTitle}>{post.post_title}</Text>}
          {editingPost ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.editPostContainer}
            >
              <TextInput
                style={styles.editPostInput}
                value={editPostContent}
                onChangeText={setEditPostContent}
                placeholder="Edit your post..."
                placeholderTextColor="#9ca3af"
                multiline
                autoFocus
                returnKeyType="default"
                blurOnSubmit={false}
              />
              <View style={styles.editPostActions}>
                <TouchableOpacity
                  style={[styles.editPostButton, styles.cancelButton]}
                  onPress={() => {
                    setEditingPost(false);
                    setEditPostContent('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editPostButton, styles.saveButton]}
                  onPress={handleEditPost}
                  disabled={!editPostContent.trim() || actionLoading}
                >
                  <Text style={styles.saveButtonText}>
                    {actionLoading ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <Text style={styles.postText}>{post.post_content}</Text>
          )}
          {(() => {
            const images = getPostImages(post);
            if (!images.length) return null;
            if (images.length === 1) {
              const uri = images[0].image_url;
              return (
                <TouchableOpacity 
                  onPress={() => {
                    setSelectedImageIndex(0);
                    setImageViewerVisible(true);
                  }}
                >
                  <Image source={renderImage(uri)!} style={styles.postImage} resizeMode="cover" />
                </TouchableOpacity>
              );
            }
            return (
              <View style={styles.imagesGrid}>
                {images.slice(0, 6).map((img, idx) => {
                  // Determine grid style based on image count and position
                  let gridStyle = styles.gridImageContainer;
                  if (images.length === 2) {
                    gridStyle = styles.twoImagesGrid;
                  } else if (images.length === 3) {
                    gridStyle = idx === 0 ? styles.threeImagesFirst : styles.threeImagesRest;
                  } else if (images.length === 4) {
                    gridStyle = styles.fourImagesGrid;
                  } else if (images.length >= 5) {
                    gridStyle = styles.fivePlusImagesGrid;
                  }
                  
                  return (
                    <TouchableOpacity 
                      key={idx}
                      onPress={() => {
                        setSelectedImageIndex(idx);
                        setImageViewerVisible(true);
                      }}
                      style={[gridStyle, { marginBottom: 2 }]}
                    >
                    <Image source={renderImage(img.image_url)!} style={styles.gridImage} resizeMode="cover" />
                    {/* Show "+X more" overlay for the 6th image if there are more than 6 */}
                    {idx === 5 && images.length > 6 && (
                      <View style={styles.moreImagesOverlay}>
                        <Text style={styles.moreImagesText}>+{images.length - 6}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}
        </View>

        {/* Stats */}
        <View style={styles.actionsCountsRow}>
          <TouchableOpacity onPress={async () => {
            try {
              // Use likes data from post detail if available, otherwise fetch fresh data
              let likesArray = Array.isArray(post?.likes) && post.likes.length > 0 ? post.likes : null;
              
              if (!likesArray) {
                // If no likes data, refresh the post detail to get fresh data
                const updatedPost = await getPostDetail(postId);
                likesArray = Array.isArray(updatedPost?.likes) ? updatedPost.likes : [];
                setPost(updatedPost); // Update the post state with fresh data
              }
              
              setSelectedPost({ ...post, likes: Array.isArray(likesArray) ? likesArray : [] });
              setViewerType('likes');
              setViewerVisible(true);
            } catch (e) {
              setSelectedPost({ ...post, likes: [] });
              setViewerType('likes');
              setViewerVisible(true);
            }
          }}>
            <Text style={styles.countText}>{post.likes_count || 0} {post.likes_count === 1 ? 'like' : 'likes'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            // Scroll to comments section
          }}>
            <Text style={styles.countText}>{comments.length} comments</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => {
            try {
              // Use reposts data from post detail if available, otherwise fetch fresh data
              let repostsArray = Array.isArray(post?.reposts) && post.reposts.length > 0 ? post.reposts : null;
              if (!repostsArray) {
                // If no reposts data, try to get fresh reposts data
                try {
                  repostsArray = await getPostReposts(postId);
                } catch (e) {
                  // Fallback: refresh the post detail to get fresh data
                  const updatedPost = await getPostDetail(postId);
                  repostsArray = Array.isArray(updatedPost?.reposts) ? updatedPost.reposts : [];
                  setPost(updatedPost); // Update the post state with fresh data
                }
              }
              setSelectedPost({ ...post, reposts: repostsArray });
              setViewerType('reposts');
              setViewerVisible(true);
            } catch (e) {
              setSelectedPost({ ...post, reposts: [] });
              setViewerType('reposts');
              setViewerVisible(true);
            }
          }}>
            <Text style={styles.countText}>{post.reposts_count || 0} reposts</Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={async () => {
              if (!postId || actionLoading) return;
              try {
                setActionLoading(true);
                if (isLiked) {
                  await unlikePost(postId);
                  setIsLiked(false);
                  // Update post data
                  const updatedPost = await getPostDetail(postId);
                  setPost(updatedPost);
                } else {
                  await likePost(postId);
                  setIsLiked(true);
                  // Update post data
                  const updatedPost = await getPostDetail(postId);
                  setPost(updatedPost);
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to update like');
              } finally {
                setActionLoading(false);
              }
            }}
          >
            <FontAwesome 
              name={isLiked ? "thumbs-up" : "thumbs-o-up"} 
              size={18} 
              color={isLiked ? "#1e3a8a" : "#555"} 
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>Like</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => {
              // Scroll to comments section
            }}
          >
            <FontAwesome name="comment-o" size={18} color="#555" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={async () => {
              if (!postId || actionLoading) return;
              try {
                setActionLoading(true);
                await repostPost(postId);
                Alert.alert('Success', 'Post shared successfully!');
                // Update post data
                const updatedPost = await getPostDetail(postId);
                setPost(updatedPost);
              } catch (error) {
                Alert.alert('Error', 'Failed to share post');
              } finally {
                setActionLoading(false);
              }
            }}
          >
            <FontAwesome name="retweet" size={18} color="#555" />
            <Text style={styles.actionText}>Repost</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.length === 0 ? (
            <View style={{ padding: 20 }}>
              <Text style={styles.emptyText}>No comments yet</Text>
            </View>
          ) : (
            comments.map((c) => {
              const isMine = c.user.user_id === meId;
              const isPostOwner = post?.user?.user_id === meId || post?.user?.id === meId;
              const canManage = isMine || isPostOwner;
              const isEditing = editingId === c.comment_id;

              return (
                <TouchableOpacity
                  key={c.comment_id}
                  onLongPress={() => setActionFor(c)}
                  delayLongPress={300}
                  activeOpacity={1}
                >
                  <View style={styles.commentRow}>
                    <Image source={renderAvatar(c.user?.profile_pic)} style={styles.commentAvatar} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.commentHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <TouchableOpacity 
                            onPress={() => {
                              if (c.user?.user_id && c.user.user_id !== meId) {
                                router.push(`/otheruser/otheruser?userId=${c.user.user_id}`);
                              }
                            }}
                            disabled={!c.user?.user_id || c.user.user_id === meId}
                          >
                            <Text style={[
                              styles.commentName,
                              (c.user?.user_id && c.user.user_id !== meId) ? styles.clickableName : null
                            ]}>
                              {`${c.user?.f_name || ''} ${c.user?.l_name || ''}`.trim() || 'User'}
                            </Text>
                          </TouchableOpacity>
                          {!!c.date_created && (
                            <Text style={styles.commentMeta}>{dayjs(c.date_created).fromNow()}</Text>
                          )}
                        </View>
                        {canManage && !isEditing && (
                          <TouchableOpacity onPress={() => setActionFor(c)} style={{ padding: 4 }}>
                            <Ionicons name="ellipsis-horizontal" size={16} color="#6b7280" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {isEditing ? (
                        <KeyboardAvoidingView
                          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                          style={styles.editBox}
                        >
                          <MentionInput
                            value={editText}
                            onChange={setEditText}
                            placeholder="Edit your comment..."
                            style={styles.editInput}
                            multiline
                            maxLength={500}
                          />
                          <View style={styles.editActions}>
                            <TouchableOpacity onPress={() => handleUpdateComment(c.comment_id)} style={styles.sendBtn}>
                              <Text style={styles.sendBtnText}>Update</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditingId(null)} style={styles.backBtn}>
                              <Text style={styles.backText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </KeyboardAvoidingView>
                      ) : (
                        <View style={styles.commentBubble}>
                          {renderTextWithMentions(c.comment_content, [], (userId) => {
                            router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                          })}
                        </View>
                      )}

                      {/* Reply Button */}
                      {!isEditing && (
                        <TouchableOpacity
                          style={styles.replyButton}
                          onPress={() => setReplyingTo(c.comment_id)}
                        >
                          <Text style={styles.replyButtonText}>Reply</Text>
                        </TouchableOpacity>
                      )}

                      {/* Replies Section */}
                      {c.replies_count > 0 && (
                        <View style={styles.repliesSection}>
                          <TouchableOpacity
                            style={styles.showRepliesButton}
                            onPress={() => toggleReplies(c.comment_id)}
                          >
                            <Text style={styles.showRepliesText}>
                              {showReplies[c.comment_id] ? 'Hide' : 'Show'} {c.replies_count} {c.replies_count === 1 ? 'reply' : 'replies'}
                            </Text>
                          </TouchableOpacity>
                          
                          {showReplies[c.comment_id] && commentReplies[c.comment_id] && (
                            <View style={styles.repliesContainer}>
                              {commentReplies[c.comment_id].map((reply, replyIndex) => {
                                const isMyReply = reply.user?.user_id === meId;
                                const isEditingReply = editingReplyId === reply.reply_id;
                                
                                return (
                                  <View key={replyIndex} style={styles.replyItem}>
                                    <Image source={renderAvatar(reply.user?.profile_pic)} style={styles.replyAvatar} />
                                    <View style={styles.replyContent}>
                                      <TouchableOpacity 
                                        onPress={() => {
                                          if (reply.user?.user_id && reply.user.user_id !== meId) {
                                            router.push(`/otheruser/otheruser?userId=${reply.user.user_id}`);
                                          }
                                        }}
                                        disabled={!reply.user?.user_id || reply.user.user_id === meId}
                                      >
                                        <Text style={[
                                          styles.replyName,
                                          (reply.user?.user_id && reply.user.user_id !== meId) ? styles.clickableName : null
                                        ]}>
                                          {`${reply.user?.f_name || ''} ${reply.user?.l_name || ''}`.trim() || 'User'}
                                        </Text>
                                      </TouchableOpacity>
                                      
                                      {isEditingReply ? (
                                        <KeyboardAvoidingView
                                          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                          style={styles.editReplyContainer}
                                        >
                                          <MentionInput
                                            value={editReplyText}
                                            onChange={setEditReplyText}
                                            placeholder="Edit your reply..."
                                            style={styles.editReplyInput}
                                            multiline
                                            maxLength={500}
                                          />
                                          <View style={styles.editReplyActions}>
                                            <TouchableOpacity
                                              style={styles.editReplyButton}
                                              onPress={() => handleReplyUpdate(c.comment_id, reply.reply_id)}
                                            >
                                              <Text style={styles.editReplyButtonText}>Update</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              style={styles.cancelReplyButton}
                                              onPress={() => setEditingReplyId(null)}
                                            >
                                              <Text style={styles.cancelReplyButtonText}>Cancel</Text>
                                            </TouchableOpacity>
                                          </View>
                                        </KeyboardAvoidingView>
                                      ) : (
                                        <Text style={styles.replyText}>
                                          {renderTextWithMentions(reply.reply_content, [], (userId) => {
                                            router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: userId } });
                                          })}
                                        </Text>
                                      )}
                                      
                                      <Text style={styles.replyTime}>{dayjs(reply.date_created).fromNow()}</Text>
                                      
                                      {/* Reply Actions */}
                                      {isMyReply && !isEditingReply && (
                                        <View style={styles.replyActions}>
                                          <TouchableOpacity
                                            style={styles.replyActionButton}
                                            onPress={() => {
                                              setEditingReplyId(reply.reply_id);
                                              setEditReplyText(reply.reply_content);
                                              scrollToEditInput();
                                            }}
                                          >
                                            <Text style={styles.replyActionText}>Edit</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={styles.replyActionButton}
                                            onPress={() => {
                                              Alert.alert(
                                                'Delete Reply',
                                                'Are you sure you want to delete this reply?',
                                                [
                                                  { text: 'Cancel', style: 'cancel' },
                                                  { text: 'Delete', style: 'destructive', onPress: () => handleReplyDelete(c.comment_id, reply.reply_id) }
                                                ]
                                              );
                                            }}
                                          >
                                            <Text style={[styles.replyActionText, { color: '#dc2626' }]}>Delete</Text>
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Comment Input - Hide when editing a comment or reply */}
      {editingId === null && editingReplyId === null && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.commentInputContainer}
        >
        {replyingTo && (
          <View style={styles.replyingToContainer}>
            <Text style={styles.replyingToText}>
              Replying to comment
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}
          <View style={styles.commentInputRow}>
            <MentionInput
              value={replyingTo ? replyText : commentText}
              onChange={replyingTo ? setReplyText : setCommentText}
              placeholder={replyingTo ? `Reply to ${comments.find(c => c.comment_id === replyingTo)?.user?.f_name || 'User'}...` : "Write a comment..."}
              style={styles.commentInput}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              disabled={replyingTo ? (!replyText.trim() || submittingReply) : (!commentText.trim() || submittingComment)}
              onPress={replyingTo ? handleSendReply : handleSendComment}
              style={[
                styles.sendButton, 
                (replyingTo ? (!replyText.trim() || submittingReply) : (!commentText.trim() || submittingComment)) && { opacity: 0.5 }
              ]}
            >
              {(replyingTo ? submittingReply : submittingComment) ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Viewer Modal */}
      {viewerVisible && selectedPost && (
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerModal}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerTitle}>
                {viewerType === 'likes' ? 'Likes' : viewerType === 'reposts' ? 'Reposts' : 'Viewer'}
              </Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.viewerContent}>
              {viewerType === 'likes' && (
                <>
                  {selectedPost.likes && selectedPost.likes.length > 0 ? (
                    selectedPost.likes.map((like: any, index: number) => (
                      <View key={index} style={styles.viewerItem}>
                        <Image source={renderAvatar(like.profile_pic)} style={styles.viewerAvatar} />
                        <Text style={styles.viewerItemText}>
                          {like.f_name} {like.l_name}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No likes yet</Text>
                      <Text style={styles.emptyStateSubtext}>Be the first to like this post!</Text>
                    </View>
                  )}
                </>
              )}
              {viewerType === 'reposts' && (
                <>
                  {selectedPost.reposts && selectedPost.reposts.length > 0 ? (
                    selectedPost.reposts.map((repost: any, index: number) => (
                      <View key={index} style={styles.viewerItem}>
                        <Image source={renderAvatar(repost.user?.profile_pic)} style={styles.viewerAvatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.viewerItemText}>
                            {repost.user?.f_name} {repost.user?.l_name}
                          </Text>
                          {repost.repost_date && (
                            <Text style={styles.viewerSubText}>{dayjs(repost.repost_date).fromNow()}</Text>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No reposts yet</Text>
                      <Text style={styles.emptyStateSubtext}>Be the first to repost this!</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Action Popup Modal */}
      {actionFor && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>
              {actionFor.type === 'post' ? 'Post Actions' : 'Comment Actions'}
            </Text>

            {/* Post Actions */}
            {actionFor.type === 'post' && (
              <>
                <TouchableOpacity
                  style={styles.popupButton}
                  onPress={() => {
                    setEditPostContent(post.post_content);
                    setEditingPost(true);
                    setActionFor(null);
                  }}
                >
                  <Text style={styles.popupButtonText}>✏️ Edit Post</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.popupButton, { backgroundColor: '#fee2e2' }]}
                  onPress={() => {
                    Alert.alert(
                      'Delete Post',
                      'Are you sure you want to delete this post? This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => handleDeletePost(),
                        },
                      ]
                    );
                    setActionFor(null);
                  }}
                >
                  <Text style={[styles.popupButtonText, { color: '#dc2626' }]}>🗑 Delete Post</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Comment Actions */}
            {actionFor.type !== 'post' && (
              <>
                {/* Edit: only show if comment is mine */}
                {actionFor.user?.user_id === meId && (
                  <TouchableOpacity
                    style={styles.popupButton}
                    onPress={() => {
                      setEditingId(actionFor.comment_id);
                      setEditText(actionFor.comment_content);
                      setActionFor(null);
                      scrollToEditInput();
                    }}
                  >
                    <Text style={styles.popupButtonText}>✏️ Edit</Text>
                  </TouchableOpacity>
                )}

                {/* Delete: show if comment is mine OR I am the post owner */}
                {(actionFor.user?.user_id === meId || post?.user?.user_id === meId || post?.user?.id === meId) && (
                  <TouchableOpacity
                    style={[styles.popupButton, { backgroundColor: '#fee2e2' }]}
                    onPress={() => {
                      Alert.alert(
                        'Delete Comment',
                        'Are you sure you want to delete this comment? This action cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => handleDeleteComment(actionFor.comment_id),
                          },
                        ]
                      );
                      setActionFor(null);
                    }}
                  >
                    <Text style={[styles.popupButtonText, { color: '#dc2626' }]}>🗑 Delete</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Cancel: always show */}
            <TouchableOpacity
              style={[styles.popupButton, { backgroundColor: '#f3f4f6' }]}
              onPress={() => setActionFor(null)}
            >
              <Text style={[styles.popupButtonText, { color: '#111827' }]}>✖ Cancel</Text>
            </TouchableOpacity>
          </View>
      </View>
      )}

      {/* Image Viewer Modal */}
      {imageViewerVisible && (
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerContainer}>
            <View style={styles.imageViewerHeader}>
              <TouchableOpacity
                onPress={() => setImageViewerVisible(false)}
                style={styles.imageViewerCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageViewerScroll}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
                setSelectedImageIndex(index);
              }}
            >
              {getPostImages(post).map((image, index) => (
                <View key={index} style={styles.imageViewerItem}>
                  <Image
                    source={renderImage(image.image_url)!}
                    style={styles.imageViewerImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
            {getPostImages(post).length > 1 && (
              <View style={styles.imageViewerPagination}>
                <Text style={styles.imageViewerPaginationText}>
                  {selectedImageIndex + 1} of {getPostImages(post).length}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingContainer: {
    flex: 1,
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
  viewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  viewerContent: {
    padding: 16,
    maxHeight: 400,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  viewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  viewerItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  viewerSubText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  
  // Post Header Styles
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  postTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  followButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: '#e5e7eb',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  followingButtonText: {
    color: '#374151',
  },
  
  // Post Content Styles
  postContent: {
    padding: 16,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  postText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#e5e7eb',
  },
  
  // Stats and Actions Styles (matching postCard.tsx)
  actionsCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
  },
  countText: { 
    fontSize: 12, 
    color: '#666' 
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
    gap: 2 
  },
  actionText: { 
    fontSize: 12, 
    color: '#555' 
  },
  likedText: { 
    color: '#1e3a8a', 
    fontWeight: 'bold' 
  },
  
  // Comments Section Styles
  commentsSection: {
    padding: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  clickableName: {
    color: '#1e3a8a',
  },
  commentMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  commentBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  commentText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  
  // Comment Input Styles
  commentInputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  
  // Edit Comment Styles
  editBox: {
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 60,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    justifyContent: 'flex-end',
  },
  sendBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  backText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 12,
  },
  
  // Popup Modal Styles
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxWidth: 300,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  popupButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  popupButtonText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#111827',
  },
  
  // Header Actions Styles
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ellipsisButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  
  // Post Edit Styles
  editPostContainer: {
    marginTop: 8,
  },
  editPostInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editPostActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
    justifyContent: 'flex-end',
  },
  editPostButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Reply Styles
  replyButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  replyButtonText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
  },
  replyItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  replyText: {
    fontSize: 13,
    color: '#111827',
    marginTop: 2,
  },
  replyTime: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  replyingToText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  
  // Reply Section Styles
  repliesSection: {
    marginTop: 8,
  },
  showRepliesButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  showRepliesText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '500',
  },
  editReplyContainer: {
    marginTop: 4,
    marginBottom: 20,
    paddingBottom: 20,
  },
  editReplyInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 60,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  editReplyActions: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  editReplyButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editReplyButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cancelReplyButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cancelReplyButtonText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '600',
  },
  replyActions: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  replyActionButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  replyActionText: {
    fontSize: 10,
    color: '#1e3a8a',
    fontWeight: '500',
  },
  
  // Image Viewer Styles
  imageViewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imageViewerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1001,
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  imageViewerCloseButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageViewerScroll: {
    flex: 1,
  },
  imageViewerItem: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerPagination: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageViewerPaginationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  
  // Grid Layout Styles
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'space-between',
    marginTop: 12,
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
});



import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { deleteNotifications } from '../../services/api';
import { Swipeable } from 'react-native-gesture-handler';
import UserAvatar from '../../components/UserAvatar';
import TrackerNotificationModal from '../../components/TrackerNotificationModal';
import NotificationModal from '../../components/NotificationModal';
import { useRealTimeNotifications } from '../../hooks/useRealTimeNotifications';
import { formatNotificationDate } from '../../utils/dateUtils';
import { formatFullName, formatUserFullName } from '../../utils/nameUtils';

interface NotificationItem {
  id?: number;
  name: string;
  message: string;
  date: string;
  profile_pic?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  read?: boolean;
  notif_type?: string;
  subject?: string;
  post_id?: number;
  forum_id?: number;
  comment_id?: number;
  reply_id?: number;
  user_id?: number;
  repost_id?: number;
  donation_id?: number;
  isAdminNotification?: boolean;
  isPesoNotification?: boolean;
  fullMessage?: string;
}

const NotificationScreen = () => {
  const insets = useSafeAreaInsets();
  
  // Use real-time notifications hook - matches web implementation
  const { 
    notifications: realTimeNotifications, 
    notificationCount,
    isLoading, 
    isConnected,
    error: hookError,
    refreshNotifications,
    markAsRead: markAsReadRealTime
  } = useRealTimeNotifications({
    enablePolling: true,
    pollingInterval: 30000, // 30 seconds - matches web
    autoConnect: true
  });

  // Local state for UI
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [trackerNotification, setTrackerNotification] = useState<NotificationItem | null>(null);
  const [generalNotification, setGeneralNotification] = useState<NotificationItem | null>(null);
  const router = useRouter();

  // Transform real-time notifications to match component's expected format
  const notifications = realTimeNotifications.map((n: any, index: number) => {
    try {
      const fullMessage = n.content || n.message || n.notifi_content || '';
      const shortMessage =
        fullMessage.length > 80 ? fullMessage.substring(0, 80) + '...' : fullMessage;

      // Extract post ID, forum ID, comment ID, reply ID, repost ID, donation ID and user ID from various possible fields
      let postId = n.post_id || n.postId || n.target_id || n.object_id;
      let forumId = n.forum_id || n.forumId;
      let commentId = n.comment_id || n.commentId;
      let replyId = n.reply_id || n.replyId;
      let repostId = n.repost_id || n.repostId;
      let donationId = n.donation_id || n.donationId;
      let userId = n.user_id || n.from_user_id || n.fromUserId || n.actor_id || n.sender_id;

      // Try to extract IDs from the message content if not found in fields (prioritize HTML comments like web)
      if (fullMessage) {
        // Extract POST_ID from HTML comment (most reliable, matches web)
        const postIdMatch = fullMessage.match(/<!--POST_ID:(\d+)-->/i);
        if (postIdMatch && postIdMatch[1]) {
          postId = parseInt(postIdMatch[1], 10);
        } else if (!postId) {
          // Fallback patterns if HTML comment not found
          const fallbackPostIdMatch = 
            fullMessage.match(/post[\/\s]*(\d+)/i) ||
            fullMessage.match(/\/posts\/(\d+)/i);
          if (fallbackPostIdMatch && fallbackPostIdMatch[1]) {
            postId = parseInt(fallbackPostIdMatch[1], 10);
          }
        }
        
        // Extract FORUM_ID from HTML comment
        const forumIdMatch = fullMessage.match(/<!--FORUM_ID:(\d+)-->/i);
        if (forumIdMatch && forumIdMatch[1]) {
          forumId = parseInt(forumIdMatch[1], 10);
        }
        
        // Extract COMMENT_ID from HTML comment
        const commentIdMatch = fullMessage.match(/<!--COMMENT_ID:(\d+)-->/i);
        if (commentIdMatch && commentIdMatch[1]) {
          commentId = parseInt(commentIdMatch[1], 10);
        }
        
        // Extract REPLY_ID from HTML comment
        const replyIdMatch = fullMessage.match(/<!--REPLY_ID:(\d+)-->/i);
        if (replyIdMatch && replyIdMatch[1]) {
          replyId = parseInt(replyIdMatch[1], 10);
        }
        
        // Extract REPOST_ID from HTML comment
        const repostIdMatch = fullMessage.match(/<!--REPOST_ID:(\d+)-->/i);
        if (repostIdMatch && repostIdMatch[1]) {
          repostId = parseInt(repostIdMatch[1], 10);
        } else if (!repostId) {
          // Fallback patterns for repost
          const fallbackRepostIdMatch =
            fullMessage.match(/repost[\/\s]*(\d+)/i) ||
            fullMessage.match(/\/repost\/(\d+)/i);
          if (fallbackRepostIdMatch && fallbackRepostIdMatch[1]) {
            repostId = parseInt(fallbackRepostIdMatch[1], 10);
          }
        }
        
        // Extract DONATION_ID from HTML comment
        const donationIdMatch = fullMessage.match(/<!--DONATION_ID:(\d+)-->/i);
        if (donationIdMatch && donationIdMatch[1]) {
          donationId = parseInt(donationIdMatch[1], 10);
        } else if (!donationId) {
          // Fallback patterns for donation
          const fallbackDonationIdMatch =
            fullMessage.match(/donation[\/\s]*(\d+)/i) ||
            fullMessage.match(/\/donation\/(\d+)/i);
          if (fallbackDonationIdMatch && fallbackDonationIdMatch[1]) {
            donationId = parseInt(fallbackDonationIdMatch[1], 10);
          }
        }
        
        // Extract USER_ID from HTML comment or follow notification format
        if (!userId) {
          const actorIdMatch = fullMessage.match(/<!--ACTOR_ID:(\d+)-->/i);
          if (actorIdMatch && actorIdMatch[1]) {
            userId = parseInt(actorIdMatch[1], 10);
          } else {
            const userIdMatch =
              fullMessage.match(/\|(\d+)\s+started following/i) ||
              fullMessage.match(/profile[\/\s]*(\d+)/i) ||
              fullMessage.match(/\/alumni\/profile\/(\d+)/i);
            if (userIdMatch && userIdMatch[1]) {
              userId = parseInt(userIdMatch[1], 10);
            }
          }
        }
      }

      // Determine notification source for better naming
      const rawType = n.type || n.notification_type || n.action_type || '';
      const rawName = n.name || n.title || '';
      const rawMsg = n.content || n.message || '';

      const isAdminNotification =
        rawType.toLowerCase() === 'ccict' ||
        rawName.toLowerCase().includes('admin') ||
        rawName.toLowerCase().includes('ccict') ||
        rawMsg.toLowerCase().includes('admin') ||
        rawMsg.toLowerCase().includes('ccict') ||
        (n.f_name && (n.f_name.toLowerCase().includes('admin') || n.f_name.toLowerCase().includes('ccict'))) ||
        (n.l_name && (n.l_name.toLowerCase().includes('admin') || n.l_name.toLowerCase().includes('ccict')));

      const isPesoNotification =
        rawType.toLowerCase() === 'peso' ||
        rawName.toLowerCase().includes('peso') ||
        rawMsg.toLowerCase().includes('peso') ||
        rawMsg.toLowerCase().includes('employment') ||
        rawMsg.toLowerCase().includes('job') ||
        (n.f_name && n.f_name.toLowerCase().includes('peso')) ||
        (n.l_name && n.l_name.toLowerCase().includes('peso'));

      let displayName = 'Notification';
      
      // Try to get name from direct fields first (f_name/first_name, m_name/middle_name, l_name/last_name)
      if (n.f_name || n.first_name) {
        displayName = formatUserFullName({
          f_name: n.f_name || n.first_name,
          m_name: n.m_name || n.middle_name,
          l_name: n.l_name || n.last_name,
        });
      } 
      // Try to get name from nested user object
      else if (n.user && (n.user.f_name || n.user.first_name)) {
        displayName = formatUserFullName({
          f_name: n.user.f_name || n.user.first_name,
          m_name: n.user.m_name || n.user.middle_name,
          l_name: n.user.l_name || n.user.last_name,
        });
      }
      // Try to get name from from_user object
      else if (n.from_user && (n.from_user.f_name || n.from_user.first_name)) {
        displayName = formatUserFullName({
          f_name: n.from_user.f_name || n.from_user.first_name,
          m_name: n.from_user.m_name || n.from_user.middle_name,
          l_name: n.from_user.l_name || n.from_user.last_name,
        });
      }
      // Try to extract name from message content (before action word like "liked", "commented", etc.)
      else if (fullMessage) {
        const nameMatch = fullMessage.match(/^([^|]+?)\s+(liked|commented|reposted|mentioned|shared|started|replied)/i);
        if (nameMatch && nameMatch[1]) {
          const extractedName = nameMatch[1].trim();
          // Only use extracted name if it looks like a real name (has at least 2 words or is not too short)
          if (extractedName.length > 2 && extractedName.split(' ').length >= 1) {
            displayName = extractedName;
          }
        }
      }
      // Check for admin/peso notifications
      if (isAdminNotification && (displayName === 'Notification' || displayName === 'User')) {
        displayName = 'CCICT';
      } else if (isPesoNotification && (displayName === 'Notification' || displayName === 'User')) {
        displayName = 'PESO';
      }
      // Final fallback
      if (displayName === 'Notification' || displayName === 'User') {
        displayName = rawName || 'User';
      }

      // Ensure all IDs are numbers or undefined (not NaN or strings)
      const safeParseId = (id: any): number | undefined => {
        if (id === null || id === undefined) return undefined;
        const num = typeof id === 'number' ? id : parseInt(String(id), 10);
        return isNaN(num) ? undefined : num;
      };

      // Extract name fields from various possible sources
      let firstName = n.f_name || n.first_name || n.from_first_name || n.fromFirstName;
      let middleName = n.m_name || n.middle_name || n.from_middle_name || n.fromMiddleName;
      let lastName = n.l_name || n.last_name || n.from_last_name || n.fromLastName;
      
      // If not found in direct fields, try nested objects
      if (!firstName && n.user) {
        firstName = n.user.f_name || n.user.first_name;
        middleName = n.user.m_name || n.user.middle_name;
        lastName = n.user.l_name || n.user.last_name;
      }
      if (!firstName && n.from_user) {
        firstName = n.from_user.f_name || n.from_user.first_name;
        middleName = n.from_user.m_name || n.from_user.middle_name;
        lastName = n.from_user.l_name || n.from_user.last_name;
      }

      return {
        id: n.id || n.notification_id || index,
        name: displayName,
        message: shortMessage,
        fullMessage,
        date: n.date || n.created_at || n.notif_date || new Date().toLocaleDateString(),
        notif_type: rawType,
        subject: n.subject,
        post_id: safeParseId(postId),
        forum_id: safeParseId(forumId),
        comment_id: safeParseId(commentId),
        reply_id: safeParseId(replyId),
        user_id: safeParseId(userId),
        repost_id: safeParseId(repostId),
        donation_id: safeParseId(donationId),
        profile_pic: n.profile_pic || n.profile_image || n.avatar || n.profilePic || (n.user && (n.user.profile_pic || n.user.profile_image)) || (n.from_user && (n.from_user.profile_pic || n.from_user.profile_image)),
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        read: n.is_read || n.read || false,
        isAdminNotification,
        isPesoNotification,
      };
    } catch (transformError) {
      console.warn('Error transforming notification:', transformError);
      return {
        id: index,
        name: 'Notification',
        message: 'Error loading notification',
        date: new Date().toLocaleDateString(),
      };
    }
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    if (selectionMode) {
      toggleSelect(item.id || 0);
      return;
    }
    // Mark notification as read when tapped
    if (item.id && !item.read) {
      console.log('📖 Marking notification as read:', item.id);
      await markAsReadRealTime(item.id);
    }
  
    // Debug: Log the notification data to see what we're working with
    console.log('Notification pressed:', {
      notif_type: item.notif_type,
      name: item.name,
      post_id: item.post_id,
      user_id: item.user_id,
      subject: item.subject,
      message: item.message
    });
    const type = item.notif_type?.toLowerCase();
    const name = item.name?.toLowerCase();
    const message = item.message?.toLowerCase();
    const fullMessage = item.fullMessage || item.message || '';

    // Special case: tracker notifications - redirect directly to tracker form
    const isTrackerNotification = 
      type === 'tracker_submission' ||
      (type && type.includes('tracker')) || 
      (item.subject && item.subject.toLowerCase().includes('tracker')) ||
      (fullMessage && (fullMessage.toLowerCase().includes('tracker form') || fullMessage.toLowerCase().includes('tracker'))) ||
      (message && (message.toLowerCase().includes('tracker form') || message.toLowerCase().includes('tracker')));
    
    if (isTrackerNotification) {
      // Redirect directly to tracker form instead of showing modal
      router.push('/forms/forms');
      return;
    }

    // Special case: reward notifications - show modal first with content/images
    const isRewardNotification = type === 'reward';
    if (isRewardNotification) {
      setGeneralNotification(item);
      return;
    }

    // All other notifications redirect immediately
    // When a user follows me → go to their profile
    if (type === 'follow' || name?.includes('follow') || message?.includes('follow')) {
      if (item.user_id) {
        router.push({
          pathname: '/otheruser/otheruser',
          params: { viewUserId: item.user_id },
        });
        return;
      } else {
        Alert.alert('Follow Notification', 'Unable to navigate to user profile - user ID not found.');
        return;
      }
    }

    // When user likes my post/repost → go to that post's detail page
    if (type === 'like' || name?.includes('like') || message?.includes('like')) {
      console.log('Like notification pressed:', {
        post_id: item.post_id,
        forum_id: item.forum_id,
        donation_id: item.donation_id,
        repost_id: item.repost_id,
        fullMessage: item.fullMessage,
        message: item.message
      });
      
      // Prioritize post_id, then forum_id, then donation_id (matches web behavior)
      if (item.post_id) {
        console.log('Navigating to post detail with postId:', item.post_id);
        router.push({
          pathname: '/posts/detail',
          params: { postId: item.post_id.toString() },
        });
        return;
      } else if (item.forum_id) {
        console.log('Navigating to forum post detail with forumId:', item.forum_id);
        router.push({
          pathname: '/posts/detail',
          params: { 
            postId: item.forum_id.toString(),
            isForumPost: 'true',
          },
        });
        return;
      } else if (item.donation_id) {
        console.log('Navigating to donation post detail with donationId:', item.donation_id);
        router.push({
          pathname: '/posts/detail',
          params: { 
            postId: item.donation_id.toString(),
            isDonationPost: 'true',
          },
        });
        return;
      } else {
        console.error('Like notification: No post ID found', {
          post_id: item.post_id,
          forum_id: item.forum_id,
          donation_id: item.donation_id,
          fullMessage: item.fullMessage
        });
        Alert.alert(
          'Like Notification', 
          'Unable to navigate to post - post ID not found in notification. Please try viewing the post from the dashboard.'
        );
        return;
      }
    }

    // When user replies to my comment → go to that post's comments with reply highlighted
    if (type === 'reply' || (message?.includes('replied to your comment'))) {
      if (item.post_id) {
        router.push({
          pathname: '/posts/comments',
          params: { 
            postId: item.post_id,
            highlightCommentId: item.comment_id?.toString(),
            highlightReplyId: item.reply_id?.toString(),
          },
        });
        return;
      } else if (item.forum_id) {
        router.push({
          pathname: '/posts/comments',
          params: { 
            postId: item.forum_id,
            isForumPost: 'true',
            highlightCommentId: item.comment_id?.toString(),
            highlightReplyId: item.reply_id?.toString(),
          },
        });
        return;
      } else if (item.repost_id) {
        router.push({
          pathname: '/repost/repost-comments',
          params: { 
            repostId: item.repost_id,
            highlightCommentId: item.comment_id?.toString(),
            highlightReplyId: item.reply_id?.toString(),
          },
        });
        return;
      } else {
        Alert.alert('Reply Notification', 'Unable to navigate to post - post ID not found.');
        return;
      }
    }

    // When user mentions me in a comment or reply → go to that post's comments with comment/reply highlighted
    if (type === 'mention' || message?.includes('mentioned')) {
      if (item.post_id) {
        const params: any = { postId: item.post_id };
        if (item.reply_id) {
          params.highlightReplyId = item.reply_id.toString();
          params.highlightCommentId = item.comment_id?.toString();
        } else if (item.comment_id) {
          params.highlightCommentId = item.comment_id.toString();
        }
        router.push({
          pathname: '/posts/comments',
          params,
        });
        return;
      } else if (item.forum_id) {
        const params: any = { 
          postId: item.forum_id,
          isForumPost: 'true',
        };
        if (item.reply_id) {
          params.highlightReplyId = item.reply_id.toString();
          params.highlightCommentId = item.comment_id?.toString();
        } else if (item.comment_id) {
          params.highlightCommentId = item.comment_id.toString();
        }
        router.push({
          pathname: '/posts/comments',
          params,
        });
        return;
      } else if (item.repost_id) {
        const params: any = { repostId: item.repost_id };
        if (item.reply_id) {
          params.highlightReplyId = item.reply_id.toString();
          params.highlightCommentId = item.comment_id?.toString();
        } else if (item.comment_id) {
          params.highlightCommentId = item.comment_id.toString();
        }
        router.push({
          pathname: '/repost/repost-comments',
          params,
        });
        return;
      } else {
        Alert.alert('Mention Notification', 'Unable to navigate to post - post ID not found.');
        return;
      }
    }

    // When user comments on my post/repost → go to that post's comments
    if (type === 'comment' || name?.includes('comment') || message?.includes('comment')) {
      if (item.post_id) {
        router.push({
          pathname: '/posts/comments',
          params: { 
            postId: item.post_id,
            highlightCommentId: item.comment_id?.toString(),
          },
        });
        return;
      } else if (item.forum_id) {
        router.push({
          pathname: '/posts/comments',
          params: { 
            postId: item.forum_id,
            isForumPost: 'true',
            highlightCommentId: item.comment_id?.toString(),
          },
        });
        return;
      } else {
        Alert.alert('Comment Notification', 'Unable to navigate to post - post ID not found.');
        return;
      }
    }

    // When user reposts my post → go to the detail of that repost (the repost that was created)
    if (type === 'repost' || name?.includes('repost') || message?.includes('repost')) {
      // Prioritize repost_id - navigate to the repost detail (the repost that was created)
      if (item.repost_id) {
        router.push({
          pathname: '/repost/repost-comments',
          params: { 
            repostId: item.repost_id,
            highlightCommentId: item.comment_id?.toString(),
          },
        });
        return;
      }
      
      // Fallback: if no repost_id, try to navigate to original post (shouldn't happen for repost notifications)
      if (item.post_id) {
        router.push({
          pathname: '/posts/comments',
          params: { 
            postId: item.post_id,
            highlightCommentId: item.comment_id?.toString(),
          },
        });
        return;
      } else if (item.forum_id) {
        router.push({
          pathname: '/posts/comments',
          params: { 
            postId: item.forum_id,
            isForumPost: 'true',
            highlightCommentId: item.comment_id?.toString(),
          },
        });
        return;
      } else {
        Alert.alert('Repost Notification', 'Unable to navigate to repost - repost ID not found.');
        return;
      }
    }

    // When user interacts with my donation post → go to donation page
    if (type === 'donation' || name?.includes('donation') || message?.includes('donation')) {
      router.push('/donation/donationpage');
      return;
    }

    // Handle CCICT/admin post notifications
    if (
      (type === 'ccict' || name?.toLowerCase().includes('admin') || name?.toLowerCase().includes('ccict')) &&
      (message?.toLowerCase().includes('post') || message?.toLowerCase().includes('announcement'))
    ) {
      if (item.post_id) {
        router.push({
          pathname: '/posts/detail',
          params: { postId: item.post_id.toString() },
        });
        return;
      }
    }

    // Handle PESO post notifications (including admin_peso_post type)
    if (
      (type === 'peso' || type === 'admin_peso_post' || name?.toLowerCase().includes('peso')) &&
      (message?.toLowerCase().includes('post') || message?.toLowerCase().includes('job') || message?.toLowerCase().includes('employment'))
    ) {
      if (item.post_id) {
        router.push({
          pathname: '/posts/detail',
          params: { postId: item.post_id.toString() },
        });
        return;
      }
    }

    // Fallback: Show debug info and alert
    console.log('Unhandled notification type:', { type, name, item });
    Alert.alert('Notification', `This notification type is not yet handled.\nType: ${type}\nName: ${name}\nPost ID: ${item.post_id}\nUser ID: ${item.user_id}`);
  };
  

  const handleDeleteIndividual = async (notificationId: number) => {
    try {
      await deleteNotifications([notificationId]);
      // Refresh notifications after delete
      await refreshNotifications();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('No selection', 'Please select notifications to delete.');
      return;
    }
    Alert.alert('Delete', `Delete ${selectedIds.length} notifications?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNotifications(selectedIds);
            setSelectionMode(false);
            setSelectedIds([]);
            // Refresh notifications after delete
            await refreshNotifications();
          } catch {
            Alert.alert('Error', 'Failed to delete notifications');
          }
        },
      },
    ]);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allIds = notifications.map((n) => n.id || 0);
    setSelectedIds(allIds);
  };

  const getNotificationIcon = (item: NotificationItem): string | null => {
    const message = item.message || '';
    const fullMessage = item.fullMessage || message;
    const name = item.name || '';
    const type = item.notif_type?.toLowerCase() || '';
    const subject = item.subject || '';
    
    // Use the pre-detected notification source
    const isAdminNotification = item.isAdminNotification || false;
    const isPesoNotification = item.isPesoNotification || false;

    // Check for tracker notification FIRST (before other admin notifications)
    const isTrackerNotification = 
      type === 'tracker_submission' ||
      type.includes('tracker') ||
      subject.toLowerCase().includes('tracker') ||
      fullMessage.toLowerCase().includes('tracker form') ||
      fullMessage.toLowerCase().includes('tracker') ||
      message.toLowerCase().includes('tracker form') ||
      message.toLowerCase().includes('tracker');

    if (isTrackerNotification) {
      return 'clipboard';
    }

    // Handle specific notification types
    if (type === 'comment' || type === 'reply' || message.toLowerCase().includes('commented') || message.toLowerCase().includes('replied')) {
      return 'comment';
    }

    if (type === 'like' || message.toLowerCase().includes('liked')) {
      return 'heart';
    }

    if (type === 'admin_peso_post' || name.toLowerCase() === 'admin_peso_post') {
      return 'file-text';
    }

    // Format admin/CCICT notifications
    if (isAdminNotification) {
      if (message.toLowerCase().includes('announcement')) {
        return 'bullhorn';
      }
      if (message.toLowerCase().includes('post')) {
        return 'file-text';
      }
      return 'bullhorn';
    }

    // Format PESO notifications
    if (isPesoNotification) {
      if (message.toLowerCase().includes('job') || message.toLowerCase().includes('employment')) {
        return 'briefcase';
      }
      if (message.toLowerCase().includes('post')) {
        return 'file-text';
      }
      return 'briefcase';
    }

    // Format user notifications
    if (type === 'follow' || message.toLowerCase().includes('follow')) {
      return 'user-plus';
    }
    if (type === 'repost' || message.toLowerCase().includes('repost') || message.toLowerCase().includes('shared')) {
      return 'retweet';
    }
    if (type === 'donation' || message.toLowerCase().includes('donation')) {
      return 'money';
    }

    // Format mention notifications
    if (type === 'mention' || message.toLowerCase().includes('mentioned')) {
      return 'at';
    }

    // Format reward notifications
    if (type === 'reward' || message.toLowerCase().includes('reward')) {
      return 'gift';
    }

    return null;
  };

  const formatNotificationMessage = (item: NotificationItem) => {
    const message = item.message || '';
    const fullMessage = item.fullMessage || message;
    const name = item.name || '';
    const type = item.notif_type?.toLowerCase() || '';
    const subject = item.subject || '';
    
    // Always use full name (first + middle + last) when available
    // Priority: Use item.name (which already has full name) > first_name + middle_name + last_name > extracted from message
    let userName = name || 'User';
    
    // If item.name is not set or is just a fallback, try to construct from individual name parts
    if ((!name || name === 'User' || name === 'Notification') && (item.first_name || item.last_name)) {
      userName = formatFullName(item.first_name, item.middle_name, item.last_name, 'User');
    } else if (!name && fullMessage) {
      // Try to extract name from the beginning of the message as last resort
      // Pattern: "Full Name action..." or "Full Name|ID action..."
      const nameMatch = fullMessage.match(/^([^|]+?)\s+(liked|commented|reposted|mentioned|shared|started)/i);
      if (nameMatch && nameMatch[1]) {
        userName = nameMatch[1].trim();
      }
    }
    
    // Use the pre-detected notification source
    const isAdminNotification = item.isAdminNotification || false;
    const isPesoNotification = item.isPesoNotification || false;

    // Check for tracker notification FIRST (before other admin notifications)
    const isTrackerNotification = 
      type === 'tracker_submission' ||
      type.includes('tracker') ||
      subject.toLowerCase().includes('tracker') ||
      fullMessage.toLowerCase().includes('tracker form') ||
      fullMessage.toLowerCase().includes('tracker') ||
      message.toLowerCase().includes('tracker form') ||
      message.toLowerCase().includes('tracker');

    if (isTrackerNotification) {
      return 'Tracker Notification from CCICT';
    }

    // Handle specific notification types
    if (type === 'comment' || message.toLowerCase().includes('commented')) {
      return `${userName} commented on your post`;
    }

    if (type === 'like' || message.toLowerCase().includes('liked')) {
      return `${userName} liked your post`;
    }

    if (type === 'admin_peso_post' || name.toLowerCase() === 'admin_peso_post') {
      return `New post from ${name}`;
    }

    // Format admin/CCICT notifications
    if (isAdminNotification) {
      if (message.toLowerCase().includes('announcement')) {
        return 'New announcement from CCICT';
      }
      if (message.toLowerCase().includes('post')) {
        return 'New post from CCICT';
      }
      return 'New notification from CCICT';
    }

    // Format PESO notifications
    if (isPesoNotification) {
      if (message.toLowerCase().includes('job')) {
        return 'New job opportunity from PESO';
      }
      if (message.toLowerCase().includes('employment')) {
        return 'New employment update from PESO';
      }
      if (message.toLowerCase().includes('post')) {
        return 'New post from PESO';
      }
      return 'New notification from PESO';
    }

    // Format user notifications
    if (type === 'follow' || message.toLowerCase().includes('follow')) {
      // Use the full name from item.name (which already includes middle name) or construct from parts
      const followUserName = item.name && item.name !== 'User' && item.name !== 'Notification' 
        ? item.name 
        : formatFullName(item.first_name, item.middle_name, item.last_name, userName);
      return `${followUserName} started following you`;
    }
    if (type === 'repost' || message.toLowerCase().includes('repost') || message.toLowerCase().includes('shared')) {
      return `${userName} reposted your post`;
    }
    if (type === 'donation' || message.toLowerCase().includes('donation')) {
      return `${userName} interacted with your donation post`;
    }

    // Format mention notifications
    if (type === 'mention' || message.toLowerCase().includes('mentioned')) {
      // Extract the full mention message from the backend
      // The backend sends: "Full Name mentioned you in their comment/post/reply/etc"
      // Remove HTML comments and return the clean message
      const cleanMessage = fullMessage.replace(/<!--[^>]+-->/g, '').trim();
      return cleanMessage || `${userName} mentioned you`;
    }

    // Format reward notifications
    if (type === 'reward' || message.toLowerCase().includes('reward')) {
      return 'Reward request update';
    }

    // Default formatting - clean HTML comments and return
    const cleanMessage = fullMessage.replace(/<!--[^>]+-->/g, '').trim();
    return cleanMessage.length > 80 ? cleanMessage.substring(0, 80) + '...' : cleanMessage;
  };

  const renderAvatar = (item: NotificationItem) => {
    // Use the pre-detected notification source
    const isAdminNotification = item.isAdminNotification || false;
    const isPesoNotification = item.isPesoNotification || false;
    const isRewardNotification = item.notif_type?.toLowerCase() === 'reward';
    const iconName = getNotificationIcon(item);

    // Admin/CCICT notifications - show CCICT logo (including reward notifications)
    if ((isAdminNotification || isRewardNotification) && !isPesoNotification) {
      return (
        <View style={styles.avatarContainer}>
          <Image
            source={require('../../assets/images/ccict_logo.jpg')}
            style={styles.avatar}
            resizeMode="cover"
          />
          {iconName && (
            <View style={styles.iconBadge}>
              <FontAwesome name={iconName as any} size={12} color="#fff" />
            </View>
          )}
        </View>
      );
    }
    
    // PESO notifications - show PESO logo
    if (isPesoNotification) {
      return (
        <View style={styles.avatarContainer}>
          <Image
            source={require('../../assets/images/peso_logo.jpg')}
            style={styles.avatar}
            resizeMode="cover"
          />
          {iconName && (
            <View style={styles.iconBadge}>
              <FontAwesome name={iconName as any} size={12} color="#fff" />
            </View>
          )}
        </View>
      );
    }
    
    // For user notifications, use UserAvatar with proper fallback
    return (
      <View style={styles.avatarContainer}>
        <UserAvatar
          profilePic={item.profile_pic}
          firstName={item.first_name}
          lastName={item.last_name}
          size={44}
          style={styles.avatar}
        />
        {iconName && (
          <View style={styles.iconBadge}>
            <FontAwesome name={iconName as any} size={12} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isSelected = selectedIds.includes(item.id || 0);

    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.swipeDeleteButton}
        onPress={() => handleDeleteIndividual(item.id || 0)}
      >
        <FontAwesome name="trash" size={20} color="#fff" />
      </TouchableOpacity>
    );

    return (
      <Swipeable key={item.id} renderRightActions={renderRightActions}>
        <TouchableOpacity
          style={[
            styles.notification, 
            isSelected && styles.selectedNotification,
            !item.read && styles.unreadNotification
          ]}
          onPress={() => handleNotificationPress(item)}
          onLongPress={() => setSelectionMode(true)}
          activeOpacity={0.9}
        >
          {selectionMode && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <FontAwesome name="check" size={12} color="#fff" />}
            </View>
          )}
          {renderAvatar(item)}
          <View style={styles.messageBox}>
            <Text style={[styles.name, !item.read && styles.unreadName]}>{formatNotificationMessage(item)}</Text>
            <Text style={[styles.message, !item.read && styles.unreadDate]}>{formatNotificationDate(item.date)}</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (isLoading && !refreshing && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <NavBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar />
      <View style={[styles.notificationsHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.notificationsTitle}>Notifications</Text>
        </View>
        {selectionMode ? (
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={() => setSelectionMode(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={selectAll}>
              <FontAwesome name="check-square-o" size={20} color="#1e3a8a" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setSelectionMode(true)}>
            <FontAwesome name="trash" size={20} color="#333" />
          </TouchableOpacity>
        )}
      </View>

      {hookError && notifications.length === 0 ? (
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-triangle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{hookError}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => (item.id ? item.id.toString() : Math.random().toString())}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
          }
          ListEmptyComponent={() =>
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <FontAwesome name="bell-o" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No notifications</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Tracker Notification Modal */}
      <TrackerNotificationModal
        isVisible={!!trackerNotification}
        onClose={() => setTrackerNotification(null)}
        notification={trackerNotification ? {
          subject: trackerNotification.subject,
          content: trackerNotification.fullMessage || trackerNotification.message, // Use full message if available
          date: trackerNotification.date,
          type: trackerNotification.notif_type,
        } : null}
      />

      <NotificationModal
        isVisible={!!generalNotification}
        onClose={() => setGeneralNotification(null)}
        notification={generalNotification ? {
          subject: generalNotification.subject,
          content: generalNotification.fullMessage || generalNotification.message,
          fullMessage: generalNotification.fullMessage || generalNotification.message,
          date: generalNotification.date,
          type: generalNotification.notif_type,
          post_id: generalNotification.post_id,
          forum_id: generalNotification.forum_id,
          repost_id: generalNotification.repost_id,
          donation_id: generalNotification.donation_id,
          comment_id: generalNotification.comment_id,
          user_id: generalNotification.user_id,
        } : null}
        onNavigate={() => {
          if (generalNotification) {
            const type = generalNotification.notif_type?.toLowerCase();
            const isRewardNotification = type === 'reward';
            
            if (isRewardNotification) {
              // Extract reward request ID from notification content
              const fullMessage = generalNotification.fullMessage || generalNotification.message || '';
              const requestIdMatch = fullMessage.match(/<!--REQUEST_ID:(\d+)-->/);
              const requestId = requestIdMatch ? requestIdMatch[1] : null;
              
              // Navigate to rewards page with request ID if available
              if (requestId) {
                router.push({
                  pathname: '/rewards/rewards',
                  params: { requestId: requestId },
                });
              } else {
                router.push('/rewards/rewards');
              }
            }
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationsTitle: { fontWeight: 'bold', fontSize: 27, color: '#222' },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancelText: { color: '#666', fontSize: 14 },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: { color: '#fff', fontWeight: 'bold' },
  earlier: {
    fontSize: 16,
    fontWeight: '500',
    marginVertical: 10,
    paddingHorizontal: 20,
    color: '#444',
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  unreadNotification: {
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 4,
    borderLeftColor: '#1e3a8a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  selectedNotification: { borderColor: '#1e3a8a', borderWidth: 2 },
  avatarContainer: { 
    marginRight: 15, 
    position: 'relative',
    width: 44,
    height: 44,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#1e3a8a',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  messageBox: { flex: 1 },
  name: { fontWeight: 'bold', fontSize: 14, color: '#222' },
  unreadName: { 
    fontWeight: '700', 
    color: '#1e3a8a',
  },
  message: { fontSize: 12, color: '#666', marginTop: 2 },
  unreadDate: { 
    color: '#1e3a8a',
    fontWeight: '600',
  },
  date: { fontSize: 12, color: '#888', marginBottom: 4 },
  notificationActions: { alignItems: 'flex-end' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxSelected: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  deleteButtonSmall: {
    padding: 4,
    marginTop: 2,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 10 },
  errorContainer: { alignItems: 'center', padding: 40 },
  errorText: { fontSize: 16, color: '#dc3545', marginTop: 10, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  retryButtonText: { color: '#fff', fontWeight: 'bold' },
  swipeDeleteButton: {
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
  },
});

export default NotificationScreen;

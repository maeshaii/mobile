import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { getNotifications, deleteNotifications, getUserInfo } from '../../services/api';
import { Swipeable } from 'react-native-gesture-handler';
import UserAvatar from '../../components/UserAvatar';

interface NotificationItem {
  id?: number;
  name: string;
  message: string;
  date: string;
  profile_pic?: string;
  first_name?: string;
  last_name?: string;
  read?: boolean;
  notif_type?: string;
  subject?: string;
  post_id?: number;
  forum_id?: number;
  comment_id?: number;
  user_id?: number;
  repost_id?: number;
  donation_id?: number;
}

const NotificationScreen = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const router = useRouter();

  const fetchNotificationsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getUserInfo();
      const userId = user?.id || user?.user_id;

      if (!userId) {
        setError('User not found');
        setNotifications([]);
        return;
      }

      const data = await getNotifications(userId);

      if (!data || !Array.isArray(data.notifications)) {
        setNotifications([]);
        return;
      }

      const transformedData = data.notifications.map((n: any, index: number) => {
        try {
          const fullMessage = n.content || n.message || '';
          const shortMessage =
            fullMessage.length > 80 ? fullMessage.substring(0, 80) + '...' : fullMessage;

          // Debug: Log the raw notification data
          console.log('Raw notification data:', n);

          // Extract post ID, forum ID, comment ID, repost ID, donation ID and user ID from various possible fields
          let postId = n.post_id || n.postId || n.post_id || n.target_id || n.object_id;
          let forumId = n.forum_id || n.forumId;
          let commentId = n.comment_id || n.commentId;
          let repostId = n.repost_id || n.repostId;
          let donationId = n.donation_id || n.donationId;
          let userId = n.user_id || n.from_user_id || n.fromUserId || n.actor_id || n.sender_id;

          // Try to extract IDs from the message content if not found in fields
          if (!postId && fullMessage) {
            const postIdMatch = fullMessage.match(/<!--POST_ID:(\d+)-->/i) || fullMessage.match(/post[\/\s]*(\d+)/i) || fullMessage.match(/\/posts\/(\d+)/i);
            if (postIdMatch) {
              postId = parseInt(postIdMatch[1]);
            }
          }

          if (!forumId && fullMessage) {
            const forumIdMatch = fullMessage.match(/<!--FORUM_ID:(\d+)-->/i);
            if (forumIdMatch) {
              forumId = parseInt(forumIdMatch[1]);
            }
          }

          if (!commentId && fullMessage) {
            const commentIdMatch = fullMessage.match(/<!--COMMENT_ID:(\d+)-->/i);
            if (commentIdMatch) {
              commentId = parseInt(commentIdMatch[1]);
            }
          }

          if (!repostId && fullMessage) {
            const repostIdMatch = fullMessage.match(/<!--REPOST_ID:(\d+)-->/i) || fullMessage.match(/repost[\/\s]*(\d+)/i) || fullMessage.match(/\/repost\/(\d+)/i);
            if (repostIdMatch) {
              repostId = parseInt(repostIdMatch[1]);
            }
          }

          if (!donationId && fullMessage) {
            const donationIdMatch = fullMessage.match(/<!--DONATION_ID:(\d+)-->/i) || fullMessage.match(/donation[\/\s]*(\d+)/i) || fullMessage.match(/\/donation\/(\d+)/i);
            if (donationIdMatch) {
              donationId = parseInt(donationIdMatch[1]);
            }
          }

          if (!userId && fullMessage) {
            // Try different patterns for user ID extraction
            const userIdMatch = fullMessage.match(/\|(\d+)\s+started following/i) || 
                               fullMessage.match(/profile[\/\s]*(\d+)/i) || 
                               fullMessage.match(/\/alumni\/profile\/(\d+)/i);
            if (userIdMatch) {
              userId = parseInt(userIdMatch[1]);
            }
          }

          return {
            id: n.id || index,
            name: n.type || n.title || n.name || n.notification_type || 'Notification',
            message: shortMessage,
            date: n.date || n.created_at || new Date().toLocaleDateString(),
            notif_type: n.type || n.notification_type || n.action_type,
            subject: n.subject,
            post_id: postId,
            forum_id: forumId,
            comment_id: commentId,
            user_id: userId,
            repost_id: repostId,
            donation_id: donationId,
            profile_pic: n.profile_pic || n.profile_image || n.avatar || n.profilePic,
            first_name: n.f_name || n.first_name || n.from_first_name || n.fromFirstName,
            last_name: n.l_name || n.last_name || n.from_last_name || n.fromLastName,
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

      setNotifications(transformedData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificationsData();
  }, [fetchNotificationsData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotificationsData();
  };

  const handleNotificationPress = (item: NotificationItem) => {
    if (selectionMode) {
      toggleSelect(item.id || 0);
      return;
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
  
    // When a user follows me → go to their profile
    if (type === 'follow' || name?.includes('follow') || message?.includes('follow')) {
      if (item.user_id) {
        router.push({
          pathname: '/otheruser/otheruser',
          params: { viewUserId: item.user_id },
        });
        return;
      } else {
        // If no user_id, try to extract from message or go to general profile
        Alert.alert('Follow Notification', 'Unable to navigate to user profile - user ID not found.');
        return;
      }
    }
  
    // When user likes my post/repost → go to that post's comments
    if (type === 'like' || name?.includes('like') || message?.includes('like')) {
      if (item.post_id) {
        router.push({
          pathname: '/posts/comments',
          params: { postId: item.post_id },
        });
        return;
      } else if (item.forum_id) {
        router.push({
          pathname: '/posts/comments',
          params: { 
            postId: item.forum_id,
            isForumPost: 'true',
          },
        });
        return;
      } else {
        // If no post_id, try to navigate to posts page or show alert
        Alert.alert('Like Notification', 'Unable to navigate to post - post ID not found.');
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
  
    // When user reposts my post → go to that post's comments
    if (type === 'repost' || name?.includes('repost') || message?.includes('repost')) {
      if (item.post_id) {
        // Check if this is a repost notification (has repost_id)
        if (item.repost_id) {
          router.push({
            pathname: '/repost/repost-comments',
            params: { 
              repostId: item.repost_id,
              highlightCommentId: item.comment_id?.toString(),
            },
          });
        } else {
          router.push({
            pathname: '/posts/comments',
            params: { 
              postId: item.post_id,
              highlightCommentId: item.comment_id?.toString(),
            },
          });
        }
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
        Alert.alert('Repost Notification', 'Unable to navigate to post - post ID not found.');
        return;
      }
    }
  
    // When user interacts with my donation post → go to donation page
    if (type === 'donation' || name?.includes('donation') || message?.includes('donation')) {
      router.push('/donation/donationpage');
      return;
    }
  
    // Special case: forms/tracker notifications
    if (
      type === 'ccict' ||
      (item.subject && item.subject.toLowerCase().includes('tracker'))
    ) {
      router.push('/forms/forms');
      return;
    }
  
    // Fallback: Show debug info and alert
    console.log('Unhandled notification type:', { type, name, item });
    Alert.alert('Notification', `This notification type is not yet handled.\nType: ${type}\nName: ${name}\nPost ID: ${item.post_id}\nUser ID: ${item.user_id}`);
  };
  

  const handleDeleteIndividual = async (notificationId: number) => {
    try {
      await deleteNotifications([notificationId]);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
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
            setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id || 0)));
            setSelectionMode(false);
            setSelectedIds([]);
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

  const renderAvatar = (item: NotificationItem) => {
    // Special case: CCICT/system notifications
    if (
      item.notif_type?.toLowerCase() === 'ccict' ||
      (item.subject && item.subject.toLowerCase().includes('tracker'))
    ) {
      return (
        <Image
          source={require('../../assets/images/ccict_logo.jpg')}
          style={styles.avatar}
          resizeMode="cover"
        />
      );
    }
    
    // For user notifications, use UserAvatar with proper fallback
    return (
      <UserAvatar
        profilePic={item.profile_pic}
        firstName={item.first_name}
        lastName={item.last_name}
        size={44}
        style={styles.avatar}
      />
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
          style={[styles.notification, isSelected && styles.selectedNotification]}
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
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.message}>{item.message}</Text>
          </View>
          <View style={styles.notificationActions}>
            <Text style={styles.date}>{item.date}</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading && !refreshing) {
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
      <View style={styles.notificationsHeader}>
        <Text style={styles.notificationsTitle}>Notifications</Text>
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

      {error ? (
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-triangle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchNotificationsData} style={styles.retryButton}>
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
            !loading ? (
              <View style={styles.emptyContainer}>
                <FontAwesome name="bell-o" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No notifications</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
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
    paddingTop: 10,
  },
  notificationsTitle: { fontWeight: 'bold', fontSize: 22, color: '#222' },
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
  selectedNotification: { borderColor: '#1e3a8a', borderWidth: 2 },
  avatar: { marginRight: 15, width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
  messageBox: { flex: 1 },
  name: { fontWeight: 'bold', fontSize: 14 },
  message: { fontSize: 13, color: '#333' },
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

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../services/api';
import UserAvatar from './UserAvatar';

interface NotificationModalProps {
  isVisible: boolean;
  onClose: () => void;
  notification: {
    subject?: string;
    content?: string;
    fullMessage?: string;
    date?: string;
    type?: string;
    post_id?: number;
    forum_id?: number;
    repost_id?: number;
    donation_id?: number;
    comment_id?: number;
    user_id?: number;
    profile_pic?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  onNavigate?: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  isVisible,
  onClose,
  notification,
  onNavigate,
}) => {
  const router = useRouter();

  if (!isVisible || !notification) return null;

  const content = notification.fullMessage || notification.content || '';
  const type = notification.type?.toLowerCase() || '';

  // Extract images from content (handle img tags and direct URLs)
  const extractImages = (text: string): string[] => {
    const images: string[] = [];
    
    // Extract from img tags
    const imgTagRegex = /<img[^>]+src=['"]([^'"]+)['"]/gi;
    let match;
    while ((match = imgTagRegex.exec(text)) !== null) {
      let imageUrl = match[1];
      // Convert relative URLs to absolute
      if (imageUrl.startsWith('/')) {
        imageUrl = `${API_BASE_URL}${imageUrl}`;
      }
      images.push(imageUrl);
    }

    // Extract from markdown-style images ![alt](url)
    const markdownRegex = /!\[[^\]]*\]\(([^)]+)\)/gi;
    while ((match = markdownRegex.exec(text)) !== null) {
      let imageUrl = match[1];
      if (imageUrl.startsWith('/')) {
        imageUrl = `${API_BASE_URL}${imageUrl}`;
      }
      images.push(imageUrl);
    }

    return images;
  };

  const images = extractImages(content);

  // Clean HTML tags from text
  const cleanHtml = (text: string) => {
    if (!text) return '';
    return text
      .replace(/<!--[^>]+-->/g, '') // Remove HTML comments
      .replace(/<img[^>]*>/gi, '') // Remove img tags (images shown separately)
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  };

  const cleanedContent = cleanHtml(content);

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      // Parse date string as UTC by appending 'Z' if no timezone info present
      // This fixes the issue where timestamps without timezone are interpreted as local time
      let dateToParse = dateStr;
      if (!dateToParse.endsWith('Z') && !dateToParse.match(/[+-]\d{2}:\d{2}$/)) {
        // If it's a space-separated datetime, replace space with 'T' and add 'Z'
        if (dateToParse.includes(' ')) {
          dateToParse = dateToParse.replace(' ', 'T') + 'Z';
        } else if (!dateToParse.includes('T')) {
          // If it's just a date, add time and timezone
          dateToParse = dateToParse + 'T00:00:00Z';
        } else {
          // If it has 'T' but no timezone, add 'Z'
          dateToParse = dateToParse + 'Z';
        }
      }
      
      const date = new Date(dateToParse);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return dateStr;
    }
  };

  const handleNavigate = () => {
    onClose();
    if (onNavigate) {
      onNavigate();
    }
  };

  const isRewardNotification = type === 'reward';
  const isTrackerNotification = type.includes('tracker') || content.includes('Tracker Form') || content.includes('tracker form');
  const isThankYouTrackerNotification = 
    isTrackerNotification && 
    (notification.subject?.toLowerCase().includes('thank you') || 
     content.toLowerCase().includes('thank you') ||
     content.toLowerCase().includes('completing the alumni tracker form'));
  
  // Check for CCICT and PESO notifications
  const isCCICTNotification = 
    type === 'ccict' || 
    content.toLowerCase().includes('ccict') ||
    (notification.subject && notification.subject.toLowerCase().includes('ccict'));
  const isPESONotification = 
    type === 'peso' || 
    type === 'admin_peso_post' ||
    content.toLowerCase().includes('peso') ||
    (notification.subject && notification.subject.toLowerCase().includes('peso'));

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            {(isThankYouTrackerNotification || isCCICTNotification || isPESONotification) && (
              <UserAvatar
                profilePic={notification.profile_pic}
                firstName={notification.first_name}
                lastName={notification.last_name}
                size={44}
                style={styles.logo}
              />
            )}
            {!isThankYouTrackerNotification && !isCCICTNotification && !isPESONotification && isRewardNotification && (
              <FontAwesome name="gift" size={20} color="#1e3a8a" style={styles.headerIcon} />
            )}
            {!isThankYouTrackerNotification && !isCCICTNotification && !isPESONotification && isTrackerNotification && (
              <FontAwesome name="clipboard" size={20} color="#1e3a8a" style={styles.headerIcon} />
            )}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {isThankYouTrackerNotification 
                  ? 'Thank You for Completing the Tracker Form'
                  : isRewardNotification 
                  ? 'Reward Update' 
                  : isTrackerNotification 
                  ? 'Tracker Update' 
                  : notification.subject || 'Notification'}
              </Text>
              {(isThankYouTrackerNotification || isCCICTNotification || isPESONotification) && notification.date && (
                <Text style={styles.headerTimestamp}>{formatDate(notification.date)}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={18} color="#4b5563" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={true}>
            <View style={styles.contentContainer}>
              {/* Images */}
              {images.length > 0 && (
                <View style={styles.imagesContainer}>
                  {images.map((imageUrl, index) => (
                    <Image
                      key={index}
                      source={{ uri: imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              )}

              {/* Content */}
              {cleanedContent && (
                <View style={
                  isThankYouTrackerNotification 
                    ? styles.thankYouContentBox 
                    : (isCCICTNotification || isPESONotification)
                    ? styles.ccictPesoContentBox
                    : styles.contentBox
                }>
                  <Text style={
                    isThankYouTrackerNotification 
                      ? styles.thankYouContentText 
                      : (isCCICTNotification || isPESONotification)
                      ? styles.ccictPesoContentText
                      : styles.contentText
                  }>
                    {cleanedContent}
                  </Text>
                </View>
              )}

              {/* Date - only show if not in header (for Thank You, CCICT, PESO notifications) */}
              {notification.date && !isThankYouTrackerNotification && !isCCICTNotification && !isPESONotification && (
                <Text style={styles.dateText}>{formatDate(notification.date)}</Text>
              )}
            </View>
          </ScrollView>

          {/* Action Button - show for reward notifications and post-related CCICT/PESO notifications */}
          {onNavigate && !isThankYouTrackerNotification && (
            <TouchableOpacity style={styles.actionButton} onPress={handleNavigate}>
              <Text style={styles.actionButtonText}>
                {isRewardNotification ? 'View My Reward Requests' : 'View Details'}
              </Text>
            </TouchableOpacity>
          )}
          
          {/* View Post button for CCICT/PESO post notifications */}
          {!onNavigate && (isCCICTNotification || isPESONotification) && notification.post_id && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/posts/detail',
                  params: { postId: notification.post_id?.toString() },
                });
              }}
            >
              <Text style={styles.actionButtonText}>View Post</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '85%',
    width: '90%',
    maxWidth: 500,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 80,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    overflow: 'hidden',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  headerTimestamp: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
    marginTop: 0,
  },
  body: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  imagesContainer: {
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
  },
  contentBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  thankYouContentBox: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  thankYouContentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1f2937',
    fontWeight: '400',
  },
  ccictPesoContentBox: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  ccictPesoContentText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#1e3a8a',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationModal;


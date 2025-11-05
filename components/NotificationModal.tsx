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
      const date = new Date(dateStr);
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
  const isTrackerNotification = type.includes('tracker') || content.includes('Tracker Form');

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {isRewardNotification && (
                <FontAwesome name="gift" size={20} color="#1e3a8a" style={styles.headerIcon} />
              )}
              {isTrackerNotification && (
                <FontAwesome name="clipboard" size={20} color="#1e3a8a" style={styles.headerIcon} />
              )}
              <Text style={styles.headerTitle}>
                {isRewardNotification ? 'Reward Update' : isTrackerNotification ? 'Tracker Update' : 'Notification'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
              <View style={styles.contentBox}>
                <Text style={styles.contentText}>{cleanedContent}</Text>
              </View>
            )}

            {/* Date */}
            {notification.date && (
              <Text style={styles.dateText}>{formatDate(notification.date)}</Text>
            )}
          </ScrollView>

          {/* Action Button */}
          {onNavigate && (
            <TouchableOpacity style={styles.actionButton} onPress={handleNavigate}>
              <Text style={styles.actionButtonText}>
                {isRewardNotification ? 'View My Reward Requests' : 'View Details'}
              </Text>
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
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
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


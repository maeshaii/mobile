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

interface TrackerNotificationModalProps {
  isVisible: boolean;
  onClose: () => void;
  notification: {
    subject?: string;
    content?: string;
    date?: string;
    type?: string;
  } | null;
}

const TrackerNotificationModal: React.FC<TrackerNotificationModalProps> = ({
  isVisible,
  onClose,
  notification,
}) => {
  const router = useRouter();

  if (!isVisible || !notification) return null;

  // Extract tracker form link from content (supports both HTML and plain text)
  const trackerLinkMatch = notification.content?.match(/href=['"]([^'"]*\/alumni\/tracker[^'"]*)['"]/) ||
                           notification.content?.match(/href=['"]([^'"]*\/tracker[^'"]*)['"]/);
  const trackerLink = trackerLinkMatch ? trackerLinkMatch[1] : null;
  
  // Split content around the tracker form link or button text
  let contentParts: string[] = [];
  if (trackerLink && notification.content) {
    // Try to split by HTML link first, then by plain text
    if (notification.content.includes('<a') || notification.content.includes('[Tracker Form Link]')) {
      contentParts = notification.content.split(/<a [^>]*>.*Tracker Form.*<\/a>/i);
    } else if (notification.content.includes('[Tracker Form Link]')) {
      // Handle placeholder format
      contentParts = notification.content.split(/\[Tracker Form Link\]/);
    } else {
      contentParts = [notification.content];
    }
  } else {
    contentParts = [notification.content || ''];
  }

  // Extract user name from greeting if present
  const greetingMatch = contentParts[0]?.match(/Hi\s+([^,]+),/i);
  const userName = greetingMatch ? greetingMatch[1].trim() : '';

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

  const handleOpenTrackerForm = () => {
    onClose();
    if (trackerLink) {
      // Extract user_id from link if present
      const userIdMatch = trackerLink.match(/user_id=(\d+)/);
      const userId = userIdMatch ? userIdMatch[1] : null;
      router.push('/forms/forms');
    } else {
      router.push('/forms/forms');
    }
  };

  // Clean HTML tags from text
  const cleanHtml = (text: string) => {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  };

  // Check for IMPORTANT section
  const hasImportantSection = contentParts[0]?.toLowerCase().includes('important');

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Light Blue Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* CCICT Logo/Icon */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/images/ccict_logo.jpg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>
                  {notification.subject || 'Please Fill Out the Tracker Form'}
                </Text>
                <Text style={styles.headerDate}>
                  {formatDate(notification.date)}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome name="times" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={true}>
            <View style={styles.contentContainer}>
              {/* Main content */}
              {contentParts[0] && (
                <View>
                  <Text style={styles.contentText}>
                    {cleanHtml(contentParts[0])}
                  </Text>
                </View>
              )}

              {/* IMPORTANT Section */}
              {hasImportantSection && (
                <View style={styles.importantSection}>
                  <View style={styles.importantHeader}>
                    <Text style={styles.importantIcon}>⚠️</Text>
                    <Text style={styles.importantTitle}>IMPORTANT</Text>
                  </View>
                  <Text style={styles.importantText}>
                    Before proceeding to answer the form, kindly prepare the necessary supporting documents to ensure a smooth process and avoid delays in completing it.
                  </Text>
                </View>
              )}

              {/* Tracker Form Button */}
              <TouchableOpacity
                style={styles.trackerButton}
                onPress={handleOpenTrackerForm}
                activeOpacity={0.8}
              >
                <Text style={styles.trackerButtonIcon}>📒</Text>
                <Text style={styles.trackerButtonText}>Tracker Form</Text>
              </TouchableOpacity>

              {/* Closing content */}
              {contentParts[1] && (
                <View style={styles.closingContent}>
                  <Text style={styles.contentText}>
                    {cleanHtml(contentParts[1])}
                  </Text>
                </View>
              )}

              {/* If no closing content, add default closing */}
              {!contentParts[1] && (
                <View style={styles.closingContent}>
                  <Text style={styles.contentText}>
                    Your timely response is greatly appreciated and helps us stay aligned and organized. If you have any questions or need assistance, feel free to reply to this message.
                  </Text>
                  <Text style={[styles.contentText, styles.signature]}>
                    Thank you!{'\n'}Best regards,{'\n'}CCICT
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    backgroundColor: '#e0f2fe', // Light blue
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#bae6fd',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#dc2626',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  logo: {
    width: 45,
    height: 45,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 16,
  },
  importantSection: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  importantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  importantIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  importantTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  importantText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#78350f',
  },
  trackerButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 16,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  trackerButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  trackerButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  closingContent: {
    marginTop: 8,
  },
  signature: {
    marginTop: 12,
    fontWeight: '500',
  },
});

export default TrackerNotificationModal;


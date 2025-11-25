import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const content = notification.content || '';
  
  console.log('TrackerNotificationModal - Original content:', content);
  
  if (trackerLink && content) {
    // Try to split by HTML link first, then by plain text
    if (content.includes('<a') || content.includes('[Tracker Form Link]')) {
      contentParts = content.split(/<a [^>]*>.*Tracker Form.*<\/a>/i);
    } else if (content.includes('[Tracker Form Link]')) {
      // Handle placeholder format
      contentParts = content.split(/\[Tracker Form Link\]/);
    } else {
      contentParts = [content];
    }
  } else {
    // Split by emoji/text patterns like "👉 Fill Out the Tracker Form" or similar
    // This pattern matches: emoji (optional) + "Fill Out the Tracker Form" or variations
    const emojiPattern = /👉\s*[Ff]ill [Oo]ut [Tt]he [Tt]racker [Ff]orm|👉\s*[Ff]ill [Oo]ut [Tt]he [Tt]racker|👉.*[Tt]racker [Ff]orm|[Ff]ill [Oo]ut [Tt]he [Tt]racker [Ff]orm/i;
    if (content && emojiPattern.test(content)) {
      contentParts = content.split(emojiPattern);
    } else {
      contentParts = [content];
    }
  }
  
  console.log('TrackerNotificationModal - contentParts:', contentParts);
  console.log('TrackerNotificationModal - contentParts[0]:', contentParts[0]);
  console.log('TrackerNotificationModal - contentParts[1]:', contentParts[1]);

  // Extract user name from greeting if present
  const greetingMatch = contentParts[0]?.match(/Hi\s+([^,]+),/i);
  const userName = greetingMatch ? greetingMatch[1].trim() : '';

  // Check if this is a "Thank You" notification (already completed)
  // Be very specific - only match if it's explicitly about completion
  // Don't match just because "thank you" appears in closing message
  const subjectLower = (notification.subject || '').toLowerCase().trim();
  const contentLower = (notification.content || '').toLowerCase();
  
  // Only match if subject explicitly says "thank you for completing" (not just "thank you")
  const hasThankYouSubject = subjectLower.includes('thank you for completing') && 
                             !subjectLower.includes('reminder') &&
                             !subjectLower.includes('please fill');
  
  // Only match if content explicitly mentions completion (not just "thank you" in closing)
  const hasCompletionContent = 
    (contentLower.includes('thank you for completing the tracker form') ||
     contentLower.includes('already completed the tracker form') ||
     contentLower.includes('your response has been recorded successfully')) &&
    !contentLower.includes('gentle reminder') &&
    !contentLower.includes('please fill out') &&
    !contentLower.includes('complete the required');
  
  const isThankYouNotification = hasThankYouSubject || hasCompletionContent;
  
  // Debug logging
  console.log('TrackerNotificationModal - subject:', notification.subject);
  console.log('TrackerNotificationModal - content preview:', notification.content?.substring(0, 100));
  console.log('TrackerNotificationModal - isThankYouNotification:', isThankYouNotification);

  // Format date - different format for thank you vs regular notifications
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      // Parse date string as UTC by appending 'Z' if no timezone info present
      let dateToParse = dateStr;
      if (!dateToParse.endsWith('Z') && !dateToParse.match(/[+-]\d{2}:\d{2}$/)) {
        if (dateToParse.includes(' ')) {
          dateToParse = dateToParse.replace(' ', 'T') + 'Z';
        } else if (!dateToParse.includes('T')) {
          dateToParse = dateToParse + 'T00:00:00Z';
        } else {
          dateToParse = dateToParse + 'Z';
        }
      }
      
      const date = new Date(dateToParse);
      
      // For thank you notifications, show full date format (e.g., "Nov 23, 2025")
      if (isThankYouNotification) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getUTCMonth()];
        const day = date.getUTCDate();
        const year = date.getUTCFullYear();
        return `${month} ${day}, ${year}`;
      }
      
      // For regular notifications, show relative time
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
    // Always redirect to tracker form
      router.push('/forms/forms');
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
  
  // Remove IMPORTANT sections from text (we add our own styled one)
  const removeImportantSection = (text: string) => {
    if (!text) return '';
    let cleaned = text;
    // More targeted removal - only remove if it's a clear IMPORTANT section with the warning text
    // Match patterns like "⚠️ IMPORTANT" or "IMPORTANT:" followed by the specific warning text
    // Be very specific to avoid removing other content
    const importantPattern = /⚠️\s*IMPORTANT[:\s]*Before proceeding to answer the form[^\.]*kindly prepare[^\.]*\./gi;
    cleaned = cleaned.replace(importantPattern, '');
    // Also remove standalone IMPORTANT sections with the full warning text
    cleaned = cleaned.replace(/IMPORTANT[:\s]*Before proceeding to answer the form[^\.]*kindly prepare[^\.]*\./gi, '');
    // Clean up multiple spaces and newlines but preserve content
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').replace(/\s{3,}/g, ' ');
    const result = cleaned.trim();
    // If we removed everything, return original text
    return result || text;
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
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../assets/images/ccict_logo.jpg')}
              style={styles.logo}
              resizeMode="cover"
            />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={2}>
                {isThankYouNotification 
                  ? 'Thank You for Completing the Tracker Form'
                  : 'Please Fill Out the Tracker Form'}
              </Text>
              <Text style={styles.headerDate}>
                {formatDate(notification.date)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome name="times" size={18} color="#4b5563" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          {isThankYouNotification ? (
            // Thank You UI - simple message only (no scroll needed)
            <View style={styles.thankYouBody}>
              <Text style={styles.thankYouMessage}>
                {(() => {
                  const rawContent = notification.content || notification.subject || '';
                  const cleaned = cleanHtml(rawContent);
                  const finalMessage = cleaned || 'Thank you for completing the tracker form. Your response has been recorded successfully.';
                  console.log('Thank You Modal - rawContent:', rawContent);
                  console.log('Thank You Modal - cleaned:', cleaned);
                  console.log('Thank You Modal - finalMessage:', finalMessage);
                  return finalMessage;
                })()}
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.body} 
              showsVerticalScrollIndicator={false}
            >
            <View style={styles.contentContainer}>
                {/* Regular tracker reminder UI */}
                <>
                  {/* Main content - before button */}
                <View>
                  <Text style={styles.contentText}>
                      {contentParts[0] 
                        ? removeImportantSection(cleanHtml(contentParts[0])) || cleanHtml(contentParts[0])
                        : cleanHtml(notification.content || '')}
                  </Text>
                </View>

                  {/* IMPORTANT Section - only show for tracker reminders */}
              <View style={styles.importantSection}>
                <View style={styles.importantHeader}>
                  <Text style={styles.importantIcon}>⚠️</Text>
                  <Text style={styles.importantTitle}>IMPORTANT</Text>
                </View>
                <Text style={styles.importantText}>
                  Before proceeding to answer the form, kindly prepare the necessary supporting documents to ensure a smooth process and avoid delays in completing it.
                </Text>
              </View>

                  {/* Tracker Form Button - replaces "👉 Fill Out the Tracker Form" text */}
              <TouchableOpacity
                style={styles.trackerButton}
                onPress={handleOpenTrackerForm}
                activeOpacity={0.8}
              >
                <View style={styles.trackerButtonIconContainer}>
                  <View style={styles.trackerButtonIconSquare} />
                </View>
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
                </>
            </View>
          </ScrollView>
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
    padding: SCREEN_WIDTH < 400 ? 12 : 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: SCREEN_WIDTH < 400 ? SCREEN_WIDTH - 24 : Math.min(500, SCREEN_WIDTH - 40),
    maxWidth: SCREEN_WIDTH < 400 ? SCREEN_WIDTH - 24 : 500,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    flexDirection: 'column',
    flexShrink: 1,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: SCREEN_WIDTH < 400 ? 16 : 20,
    paddingVertical: SCREEN_WIDTH < 400 ? 12 : 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: SCREEN_WIDTH < 400 ? 60 : 70,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
    marginRight: 8,
    minWidth: 0, // Allows text to wrap properly
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 4,
    lineHeight: 22,
    flexShrink: 1,
  },
  headerDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    marginLeft: 8,
  },
  body: {
    maxHeight: 400,
    minHeight: 200,
  },
  thankYouBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    width: '100%',
    backgroundColor: 'white',
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
    marginTop: 12,
    marginBottom: 16,
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
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 16,
    minHeight: 52,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  trackerButtonIconContainer: {
    marginRight: 8,
  },
  trackerButtonIconSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#fbbf24',
    borderRadius: 2,
  },
  trackerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closingContent: {
    marginTop: 8,
  },
  signature: {
    marginTop: 12,
    fontWeight: '500',
  },
  thankYouMessage: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    textAlign: 'left',
    width: '100%',
  },
});

export default TrackerNotificationModal;


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

interface RewardNotificationModalProps {
  isVisible: boolean;
  onClose: () => void;
  notification: {
    subject?: string;
    content?: string;
    fullMessage?: string;
    date?: string;
    type?: string;
  } | null;
}

const RewardNotificationModal: React.FC<RewardNotificationModalProps> = ({
  isVisible,
  onClose,
  notification,
}) => {
  const router = useRouter();

  if (!isVisible || !notification) return null;

  const content = notification.fullMessage || notification.content || '';
  const subject = notification.subject || '';

  // Clean HTML tags from text
  const cleanHtml = (text: string) => {
    if (!text) return '';
    return text
      .replace(/<!--[^>]+-->/g, '') // Remove HTML comments
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  };

  // Check if this is a "removed from inventory" notification
  const isRemovedFromInventory = 
    content.toLowerCase().includes('removed from inventory') ||
    content.toLowerCase().includes('removed from the inventory') ||
    subject.toLowerCase().includes('removed from inventory') ||
    subject.toLowerCase().includes('removed from the inventory');

  // Extract reward name from content
  // Pattern: "Your request for "{reward_name}" was cancelled..."
  // or "The {reward_name} that you requested..."
  const extractRewardName = (text: string): string => {
    const cleaned = cleanHtml(text);
    
    // Try pattern: "Your request for "{reward_name}" was cancelled"
    const requestPattern = /request for "([^"]+)"/i;
    const requestMatch = cleaned.match(requestPattern);
    if (requestMatch && requestMatch[1]) {
      return requestMatch[1];
    }
    
    // Try pattern: "The {reward_name} that you requested"
    const thePattern = /the ([^"]+?) that you requested/i;
    const theMatch = cleaned.match(thePattern);
    if (theMatch && theMatch[1]) {
      return theMatch[1].trim();
    }
    
    // Fallback: try to extract from quotes
    const quotePattern = /"([^"]+)"/;
    const quoteMatch = cleaned.match(quotePattern);
    if (quoteMatch && quoteMatch[1]) {
      return quoteMatch[1];
    }
    
    return 'reward';
  };

  const rewardName = extractRewardName(content);

  // Extract request ID from notification content (if available)
  // Pattern: <!--REQUEST_ID:123-->
  const extractRequestId = (text: string): string | null => {
    const requestIdMatch = text.match(/<!--REQUEST_ID:(\d+)-->/);
    return requestIdMatch ? requestIdMatch[1] : null;
  };

  const requestId = extractRequestId(content);

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
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

  const handleViewRewards = () => {
    onClose();
    // If we have a request ID, navigate to the specific reward detail
    // Otherwise, just open the requests modal
    if (requestId) {
      router.push(`/rewards/rewards?requestId=${requestId}`);
    } else {
      router.push('/rewards/rewards?openRequests=true');
    }
  };

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
            <FontAwesome name="gift" size={24} color="#1e3a8a" style={styles.headerIcon} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={2}>
                {isRemovedFromInventory 
                  ? 'Reward Removed From Inventory'
                  : 'Reward Update'}
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
          <View style={styles.body}>
            <View style={styles.contentContainer}>
              {isRemovedFromInventory ? (
                <Text style={styles.bodyText}>
                  The <Text style={styles.rewardName}>{rewardName}</Text> that you requested has been removed from the inventory.
                </Text>
              ) : (
                <Text style={styles.bodyText}>
                  {cleanHtml(content)}
                </Text>
              )}
            </View>
          </View>

          {/* Action Button - Only show for non-removed-from-inventory notifications */}
          {!isRemovedFromInventory && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleViewRewards}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>View My Reward Requests</Text>
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
  headerIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
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
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  contentContainer: {
    width: '100%',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    textAlign: 'left',
  },
  rewardName: {
    fontWeight: '600',
    color: '#1e3a8a',
  },
  actionButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RewardNotificationModal;


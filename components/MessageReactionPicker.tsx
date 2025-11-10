/**
 * Message Reaction Picker Component
 * Allows users to add emoji reactions to messages
 * Similar to web's reaction picker but optimized for mobile touch interface
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';

interface MessageReaction {
  emoji: string;
  userId: number;
  userName?: string;
}

interface MessageReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectReaction: (emoji: string) => void;
  messageId: string;
  currentReactions?: MessageReaction[];
  currentUserId: number;
}

// Popular emojis for quick access
const QUICK_REACTIONS = ['😊', '❤️', '👍', '😂', '😮', '😢'];

// Extended emoji categories
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘'],
  'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
  'Objects': ['🎉', '🎊', '🎁', '🎈', '🎂', '🎯', '🎮', '⚽', '🏀', '🎵', '🎸', '📱', '💻', '⚡', '🔥', '⭐']
};

export const MessageReactionPicker: React.FC<MessageReactionPickerProps> = ({
  visible,
  onClose,
  onSelectReaction,
  messageId,
  currentReactions = [],
  currentUserId
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Smileys');
  const [scaleAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  const handleSelectEmoji = (emoji: string) => {
    // Check if user already reacted with this emoji
    const existingReaction = currentReactions.find(
      r => r.emoji === emoji && r.userId === currentUserId
    );

    // Haptic feedback on iOS
    if (Platform.OS === 'ios') {
      const { impactAsync, ImpactFeedbackStyle } = require('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Light);
    }

    onSelectReaction(emoji);
    onClose();
  };

  const isReacted = (emoji: string): boolean => {
    return currentReactions.some(
      r => r.emoji === emoji && r.userId === currentUserId
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.container,
                {
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Add Reaction</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Reactions */}
              <View style={styles.quickReactions}>
                <Text style={styles.sectionTitle}>Quick Reactions</Text>
                <View style={styles.emojiRow}>
                  {QUICK_REACTIONS.map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiButton,
                        isReacted(emoji) && styles.emojiButtonReacted
                      ]}
                      onPress={() => handleSelectEmoji(emoji)}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category Tabs */}
              <View style={styles.categoryTabs}>
                {Object.keys(EMOJI_CATEGORIES).map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryTab,
                      selectedCategory === category && styles.categoryTabActive
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        selectedCategory === category && styles.categoryTabTextActive
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Emoji Grid */}
              <View style={styles.emojiGrid}>
                {EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES].map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiGridButton,
                      isReacted(emoji) && styles.emojiButtonReacted
                    ]}
                    onPress={() => handleSelectEmoji(emoji)}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                    {isReacted(emoji) && (
                      <View style={styles.reactedIndicator}>
                        <Text style={styles.reactedIndicatorText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '85%',
    maxHeight: '70%',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  quickReactions: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  emojiButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    margin: 4,
  },
  emojiButtonReacted: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  emoji: {
    fontSize: 28,
  },
  categoryTabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  categoryTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1C4E80',
  },
  categoryTabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#1C4E80',
    fontWeight: '700',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    maxHeight: 250,
  },
  emojiGridButton: {
    width: '20%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  reactedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactedIndicatorText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default MessageReactionPicker;


/**
 * Reply Preview Component
 * Shows preview of message being replied to
 * Similar to web's reply functionality
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface ReplyPreviewProps {
  senderName: string;
  messageContent: string;
  onCancel: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  senderName,
  messageContent,
  onCancel,
}) => {
  // Truncate long messages
  const truncateMessage = (text: string, maxLength: number = 50): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <View style={styles.container}>
      <View style={styles.replyBar} />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <FontAwesome name="reply" size={14} color="#1C4E80" style={styles.icon} />
          <View style={styles.messageInfo}>
            <Text style={styles.senderName}>Replying to {senderName}</Text>
            <Text style={styles.messageContent} numberOfLines={1}>
              {truncateMessage(messageContent)}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <FontAwesome name="times" size={18} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f0f4f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  replyBar: {
    width: 4,
    backgroundColor: '#1C4E80',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  messageInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C4E80',
    marginBottom: 2,
  },
  messageContent: {
    fontSize: 13,
    color: '#666',
  },
  cancelButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default ReplyPreview;


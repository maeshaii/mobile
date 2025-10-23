import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';

interface MentionUser {
  user_id: number;
  name: string;
  f_name: string;
  m_name: string;
  l_name: string;
  profile_pic: string;
}

/**
 * Render text with mentions (@username) as clickable links
 * Note: onMentionPress callback should be provided by the parent component
 */
export const renderTextWithMentions = (
  text: string, 
  users: MentionUser[] = [], 
  onMentionPress?: (userId: number) => void
): React.ReactNode[] => {
  if (!text) return [text];

  const mentionRegex = /@(\w+)/g;
  const parts = text.split(mentionRegex);
  
  return parts.map((part, index) => {
    if (mentionRegex.test(part)) {
      // This is a mention (@username)
      const username = part.substring(1); // Remove @
      
      // Find the user in the users array
      const user = users.find(u => u.name === username || `${u.f_name} ${u.l_name}`.trim() === username);
      
      if (user && onMentionPress) {
        return React.createElement(
          TouchableOpacity,
          {
            key: index,
            onPress: () => onMentionPress(user.user_id)
          },
          React.createElement(
            Text,
            { style: styles.mentionText },
            `@${user.name}`
          )
        );
      } else {
        // User not found or no callback, render as plain text
        return React.createElement(
          Text,
          { key: index, style: styles.mentionText },
          part
        );
      }
    } else {
      // Regular text
      return React.createElement(
        Text,
        { key: index },
        part
      );
    }
  });
};

/**
 * Extract mentioned users from text
 */
export const extractMentions = (text: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)]; // Remove duplicates
};

/**
 * Check if text contains mentions
 */
export const hasMentions = (text: string): boolean => {
  return /@\w+/.test(text);
};

const styles = StyleSheet.create({
  mentionText: {
    color: '#007bff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

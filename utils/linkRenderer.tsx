import React from 'react';
import { Text, Linking, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Detects URLs in text and renders them as clickable links for React Native
 * Supports http://, https://, www., and plain domain patterns
 */
export const renderTextWithLinks = (
  text: string,
  baseStyle?: any,
  linkStyle?: any
): React.ReactNode[] => {
  if (!text) return [];
  
  // Enhanced URL regex that matches:
  // - http:// or https:// URLs
  // - www. URLs
  // - plain domains (like example.com)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(com|net|org|edu|gov|io|co|uk|ph|info|biz|xyz|me|tv|cc|ws|name|mobi|asia|jobs|museum|travel)[^\s]*)/gi;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  
  // Reset regex for global search
  urlRegex.lastIndex = 0;
  
  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`text-${key++}`} style={baseStyle}>
          {text.substring(lastIndex, match.index)}
        </Text>
      );
    }
    
    // Create clickable link
    let url = match[0];
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    parts.push(
      <Text
        key={`link-${key++}`}
        onPress={async () => {
          try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
              await Linking.openURL(url);
            } else {
              console.error('Cannot open URL:', url);
            }
          } catch (error) {
            console.error('Error opening URL:', error);
          }
        }}
        style={[
          baseStyle,
          {
            color: '#007bff',
            textDecorationLine: 'underline',
            ...linkStyle
          }
        ]}
      >
        {match[0]}
      </Text>
    );
    
    lastIndex = urlRegex.lastIndex;
  }
  
  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(
      <Text key={`text-${key++}`} style={baseStyle}>
        {text.substring(lastIndex)}
      </Text>
    );
  }
  
  // If no URLs found, return the original text
  if (parts.length === 0) {
    return [
      <Text key="text-only" style={baseStyle}>
        {text}
      </Text>
    ];
  }
  
  return parts;
};


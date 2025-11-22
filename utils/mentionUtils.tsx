import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { searchAlumni } from '../services/api';

interface MentionUser {
  user_id: number;
  name: string;
  f_name: string;
  m_name: string;
  l_name: string;
  profile_pic: string;
}

/**
 * Render text with mentions (@username) and names as clickable links
 * Uses the same approach as web frontend - handles both @mentions and name detection
 */
export const renderTextWithMentions = (
  text: string, 
  users: MentionUser[] = [], 
  onMentionPress?: (userId: number) => void,
  baseStyle?: any
): React.ReactNode => {
  if (!text) return <Text style={baseStyle}>{text}</Text>;

  // Updated regex to match @mentions with or without spaces (e.g., @FirstLast, @John Doe, @Harlene Ortega)
  // The backend regex r'@([^@\s]+)' matches @ followed by non-whitespace characters
  // But mentions can be stored as "@FirstName LastName" so we need to match until whitespace or end
  // We'll match @ followed by one or more words (allowing spaces between words)
  // This pattern matches: @ followed by word(s) with optional spaces, stopping at punctuation or end of string
  const mentionRegex = /@([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)/g;
  // Enhanced URL regex that matches:
  // - http:// or https:// URLs
  // - www. URLs
  // - plain domains (like example.com)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(com|net|org|edu|gov|io|co|uk|ph|info|biz|xyz|me|tv|cc|ws|name|mobi|asia|jobs|museum|travel)[^\s]*)/gi;
  
  // First, split by URLs
  const urlParts: string[] = [];
  let lastIndex = 0;
  let match;
  urlRegex.lastIndex = 0;
  
  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before URL
    if (match.index > lastIndex) {
      urlParts.push(text.substring(lastIndex, match.index));
    }
    // Add URL
    urlParts.push(match[0]);
    lastIndex = urlRegex.lastIndex;
  }
  // Add remaining text
  if (lastIndex < text.length) {
    urlParts.push(text.substring(lastIndex));
  }
  
  const result: React.ReactNode[] = [];
  
  urlParts.forEach((urlPart, urlIndex) => {
    // Check if this is a URL (using the same regex pattern)
    if (/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(com|net|org|edu|gov|io|co|uk|ph|info|biz|xyz|me|tv|cc|ws|name|mobi|asia|jobs|museum|travel)[^\s]*)/i.test(urlPart)) {
      // Create clickable link
      let url = urlPart;
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      result.push(
        <Text
          key={`url-${urlIndex}`}
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
          style={[baseStyle, { color: '#007bff', textDecorationLine: 'underline' }]}
        >
          {urlPart}
        </Text>
      );
      return;
    }
    
    // Process mentions in this part
    let lastIndex = 0;
    let match;
    // Match @ followed by name with or without spaces (e.g., @Harlene Ortega, @JohnDoe, @Angel Khyla Marie Aboloc)
    // Match multiple words (first, middle, last name) and stop at the next space, punctuation, or end
    // This ensures we only match the mention, not the rest of the text
    // Updated to match 3+ words for full names (first, middle, last)
    // The pattern matches @ followed by word(s), stopping at whitespace, punctuation, or end of string
    const mentionRegexLocal = /@([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)(?=\s|$|[,.;:!?\-])/g;
    
    while ((match = mentionRegexLocal.exec(urlPart)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        result.push(
          <Text key={`text-${urlIndex}-${lastIndex}`} style={baseStyle}>
            {urlPart.substring(lastIndex, match.index)}
          </Text>
        );
      }
      
      // Add the mention as clickable
      const mentionText = match[0]; // Full match including @
      const username = match[1]; // Captured group (username without @)
      
      // Display the name as-is (it may already have spaces like "Harlene Ortega")
      // If it doesn't have spaces, try to split camelCase (e.g., "JohnDoe" -> "John Doe")
      let displayName = username;
      if (!username.includes(' ')) {
        // Only try to split if there are no spaces
        const splitName = username.replace(/([a-z])([A-Z])/g, '$1 $2');
        if (splitName !== username && splitName.includes(' ')) {
          displayName = splitName;
        }
      }
      
      result.push(
        <TouchableOpacity
          key={`mention-${urlIndex}-${match.index}`}
          onPress={async () => {
            if (onMentionPress) {
              try {
                // The username might be in format "Harlene Ortega" (with space) or "FirstLast" (no space)
                // Try searching with the username as-is first
                let response = await searchAlumni(username);
                
                // If no results and username doesn't have spaces, try splitting camelCase (e.g., "JohnDoe" -> "John Doe")
                if ((!response.results || response.results.length === 0) && !username.includes(' ')) {
                  const splitName = username.replace(/([a-z])([A-Z])/g, '$1 $2');
                  if (splitName !== username) {
                    response = await searchAlumni(splitName);
                  }
                }
                
                if (response.results && response.results.length > 0) {
                  const foundUser = response.results[0];
                  // Try both id and user_id fields
                  const userId = foundUser.id || foundUser.user_id || foundUser.userId;
                  if (userId) {
                    onMentionPress(userId);
                  } else {
                    console.error('User ID not found in search result:', foundUser);
                  }
                } else {
                  console.error('No users found for mention:', username);
                }
              } catch (error) {
                console.error('Error searching for user:', error);
              }
            }
          }}
        >
          <Text style={styles.mentionText}>
            @{displayName}
          </Text>
        </TouchableOpacity>
      );
      
      lastIndex = mentionRegexLocal.lastIndex;
    }
    
      // Add remaining text after last mention
      if (lastIndex < urlPart.length) {
        result.push(
          <Text key={`text-${urlIndex}-${lastIndex}`} style={baseStyle}>
            {urlPart.substring(lastIndex)}
          </Text>
        );
      }
  });
  
  return <Text style={baseStyle}>{result}</Text>;
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
    // No underline - just highlighted name like web
  },
});

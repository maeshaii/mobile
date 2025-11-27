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
                console.warn('Cannot open URL:', url);
              }
            } catch (error) {
              console.warn('Error opening URL:', error);
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
    // Use regex to find @mentions, but ensure we only capture the name part
    // The regex matches @ followed by alphanumeric characters (with optional spaces for multi-word names)
    // and stops at the first space, punctuation, or end of string
    // Updated to use greedy matching to capture full names with spaces
    let lastIndex = 0;
    const mentionRegexLocal = /@([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)(?=\s|$|[,.;:!?\-]|@)/g;
    
    // Reset regex lastIndex to ensure proper matching
    mentionRegexLocal.lastIndex = 0;
    let match;
    
    while ((match = mentionRegexLocal.exec(urlPart)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        result.push(
          <Text key={`text-${urlIndex}-${lastIndex}`} style={baseStyle}>
            {urlPart.substring(lastIndex, match.index)}
          </Text>
        );
      }
      
      // Extract the mention - match[0] includes @, match[1] is just the name
      const fullMatch = match[0]; // e.g., "@HarleyDaveChavez" or "@Harley Dave Chavez"
      const username = match[1]; // e.g., "HarleyDaveChavez" or "Harley Dave Chavez"
      
      // CRITICAL: Trim to ensure no trailing spaces or extra text
      const cleanUsername = username.trim();
      
      // Display the name as-is (it may already have spaces like "Harlene Ortega")
      // If it doesn't have spaces, try to split camelCase (e.g., "JohnDoe" -> "John Doe")
      let displayName = cleanUsername;
      if (!cleanUsername.includes(' ')) {
        // Only try to split if there are no spaces
        const splitName = cleanUsername.replace(/([a-z])([A-Z])/g, '$1 $2');
        if (splitName !== cleanUsername && splitName.includes(' ')) {
          displayName = splitName;
        }
      }
      
      // Only render the mention name as clickable, not the entire text
      result.push(
        <TouchableOpacity
          key={`mention-${urlIndex}-${match.index}`}
          activeOpacity={0.7}
          onPress={async () => {
            if (onMentionPress) {
              try {
                // Use the cleaned username (trimmed to ensure no extra text)
                // The username might be in format "Harlene Ortega" (with space) or "FirstLast" (no space)
                // Try searching with the username as-is first
                let response = await searchAlumni(cleanUsername);
                
                // If no results and username doesn't have spaces, try splitting camelCase (e.g., "JohnDoe" -> "John Doe")
                if ((!response.results || response.results.length === 0) && !cleanUsername.includes(' ')) {
                  const splitName = cleanUsername.replace(/([a-z])([A-Z])/g, '$1 $2');
                  if (splitName !== cleanUsername) {
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
                    console.warn('User ID not found in search result:', foundUser);
                  }
                } else {
                  console.log('No users found for mention:', cleanUsername);
                }
              } catch (error) {
                console.warn('Error searching for user:', error);
              }
            }
          }}
        >
          <Text style={styles.mentionText}>
            {displayName}
          </Text>
        </TouchableOpacity>
      );
      
      // Update lastIndex to move past the full mention match
      lastIndex = mentionRegexLocal.lastIndex;
    }
    
    // Add remaining text after last mention (this should be the text after the mention, like " hello")
    if (lastIndex < urlPart.length) {
      result.push(
        <Text key={`text-${urlIndex}-${lastIndex}`} style={baseStyle}>
          {urlPart.substring(lastIndex)}
        </Text>
      );
    }
  });
  
  // Return the result array wrapped in a Text component
  // The baseStyle is applied to the outer Text, but individual parts can override it
  // This ensures only the mention name is highlighted, not the entire comment
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

import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  onMentionPress?: (userId: number) => void
): React.ReactNode => {
  if (!text) return <Text>{text}</Text>;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const mentionRegex = /@(\w+)/g;
  // Enhanced regex to detect names (First Last format)
  const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  
  const parts = text.split(urlRegex);
  
  return (
    <Text>
      {parts.map((part, index) => {
        if (urlRegex.test(part)) {
          // Handle URLs
          return (
            <Text key={index} style={{ color: '#007bff', textDecorationLine: 'underline' }}>
              {part}
            </Text>
          );
        }
        
        // Handle mentions (@username) and names
        const mentionParts = part.split(mentionRegex);
        const processedMentionParts = mentionParts.map((mentionPart, mentionIndex) => {
          if (mentionRegex.test(mentionPart)) {
            // This is a @mention
            const username = mentionPart.substring(1); // Remove @
            
            return (
              <TouchableOpacity
                key={`${index}-${mentionIndex}`}
                onPress={() => {
                  if (onMentionPress) {
                    // Use the same search approach as web frontend
                    searchAlumni(username)
                      .then(response => {
                        if (response.results && response.results.length > 0) {
                          const foundUser = response.results[0];
                          onMentionPress(foundUser.id);
                        }
                      })
                      .catch(error => {
                        console.error('Error searching for user:', error);
                      });
                  }
                }}
              >
                <Text style={styles.mentionText}>
                  {mentionPart}
                </Text>
              </TouchableOpacity>
            );
          }
          
          // Handle names (First Last format)
          const nameParts = mentionPart.split(nameRegex);
          return nameParts.map((namePart, nameIndex) => {
            if (nameRegex.test(namePart)) {
              // This looks like a name
              return (
                <TouchableOpacity
                  key={`${index}-${mentionIndex}-${nameIndex}`}
                  onPress={() => {
                    if (onMentionPress) {
                      // Search for the user by name
                      searchAlumni(namePart)
                        .then(response => {
                          if (response.results && response.results.length > 0) {
                            const foundUser = response.results[0];
                            onMentionPress(foundUser.id);
                          }
                        })
                        .catch(error => {
                          console.error('Error searching for user:', error);
                        });
                    }
                  }}
                >
                  <Text style={styles.mentionText}>
                    {namePart}
                  </Text>
                </TouchableOpacity>
              );
            }
            
            // Regular text
            return (
              <Text key={`${index}-${mentionIndex}-${nameIndex}`}>
                {namePart}
              </Text>
            );
          });
        });
        
        return processedMentionParts;
      })}
    </Text>
  );
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

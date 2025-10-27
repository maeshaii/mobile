import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { getFollowingForMentions } from '../services/api';
import UserAvatar from './UserAvatar';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  disabled?: boolean;
  style?: any;
  multiline?: boolean;
  maxLength?: number;
}

interface User {
  user_id: number;
  name: string;
  f_name: string;
  m_name: string;
  l_name: string;
  profile_pic: string;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder = "Write a reply...",
  onSubmit,
  disabled = false,
  style = {},
  multiline = true,
  maxLength
}) => {
  const [following, setFollowing] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const textInputRef = useRef<TextInput>(null);

  // Load following users on component mount
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const response = await getFollowingForMentions();
        if (response.success) {
          setFollowing(response.following);
        }
      } catch (error) {
        console.error('Error loading following users:', error);
      }
    };
    loadFollowing();
  }, []);

  // Handle text change and detect @mentions
  const handleTextChange = (text: string) => {
    onChange(text);

    // Find the last @ symbol before cursor
    const lastAtIndex = text.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = text.substring(lastAtIndex + 1);
      
      // Check if there's no space after @ (meaning we're typing a mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowSuggestions(true);
        
        // Filter suggestions based on what's typed after @
        const filteredSuggestions = following.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.f_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.l_name.toLowerCase().includes(textAfterAt.toLowerCase())
        );
        setSuggestions(filteredSuggestions);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
        setMentionQuery('');
      }
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
    }
  };

  // Handle suggestion selection
  const selectSuggestion = (user: User) => {
    if (mentionStart === -1) return;

    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(value.length);
    
    const newValue = beforeMention + `@${user.name} ` + afterMention;
    onChange(newValue);
    
    setShowSuggestions(false);
    setMentionStart(-1);
    setMentionQuery('');
    
    // Focus back to text input
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyPress = (e: any) => {
    if (!showSuggestions) {
      if (e.nativeEvent.key === 'Enter' && onSubmit) {
        onSubmit();
      }
      return;
    }

    switch (e.nativeEvent.key) {
      case 'ArrowDown':
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (suggestions[selectedIndex]) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setMentionQuery('');
        break;
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        ref={textInputRef}
        value={value}
        onChangeText={handleTextChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        editable={!disabled}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          styles.textInput,
          disabled && styles.disabledInput
        ]}
        onFocus={() => {
          // Re-trigger mention detection on focus
          const lastAtIndex = value.lastIndexOf('@');
          
          if (lastAtIndex !== -1) {
            const textAfterAt = value.substring(lastAtIndex + 1);
            if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
              setMentionStart(lastAtIndex);
              setMentionQuery(textAfterAt);
              setShowSuggestions(true);
              const filteredSuggestions = following.filter(user =>
                user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
                user.f_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
                user.l_name.toLowerCase().includes(textAfterAt.toLowerCase())
              );
              setSuggestions(filteredSuggestions);
              setSelectedIndex(0);
            }
          }
        }}
        onBlur={() => {
          // Delay hiding suggestions to allow selection
          setTimeout(() => setShowSuggestions(false), 150);
        }}
      />
      
      {/* Mention Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView style={styles.suggestionsScroll} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.suggestionsHeader}>
              <Text style={styles.suggestionsHeaderText}>Mention someone</Text>
            </View>
            
            {/* Suggestions */}
            {suggestions.map((user, index) => (
              <TouchableOpacity
                key={user.user_id}
                onPress={() => selectSuggestion(user)}
                style={[
                  styles.suggestionItem,
                  index === selectedIndex && styles.selectedSuggestion
                ]}
              >
                <UserAvatar
                  profilePic={user.profile_pic}
                  firstName={user.f_name}
                  lastName={user.l_name}
                  size={32}
                  style={styles.suggestionAvatar}
                />
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>
                    {user.f_name} {user.m_name || ''} {user.l_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            
            {/* Footer hint */}
            {suggestions.length === 0 && mentionQuery && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>
                  No users found matching "{mentionQuery}"
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: 'System',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  suggestionsContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e4e6ea',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    maxHeight: 300,
    marginBottom: 4,
  },
  suggestionsScroll: {
    maxHeight: 300,
  },
  suggestionsHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e6ea',
    backgroundColor: '#f8f9fa',
  },
  suggestionsHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65676b',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedSuggestion: {
    backgroundColor: '#e3f2fd',
  },
  suggestionAvatar: {
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1e21',
  },
  noResultsContainer: {
    padding: 12,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 12,
    color: '#65676b',
    fontStyle: 'italic',
  },
});

export default MentionInput;

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, findNodeHandle, UIManager, Keyboard, Platform } from 'react-native';
import { getFollowingForMentions, getUserInfo, getCurrentUserId } from '../services/api';
import UserAvatar from './UserAvatar';
import { formatUserFullName } from '../utils/nameUtils';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  disabled?: boolean;
  style?: any;
  multiline?: boolean;
  maxLength?: number;
  onSuggestionsChange?: (showSuggestions: boolean, inputPosition?: { x: number; y: number; width: number; height: number } | null) => void;
  textInputStyle?: any; // Allow overriding TextInput styles
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
  maxLength,
  onSuggestionsChange,
  textInputStyle = {}
}) => {
  const [following, setFollowing] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const textInputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  const [dropdownAbove, setDropdownAbove] = useState(true); // Default to above to avoid keyboard
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Load following users and current user on component mount
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const [response, me] = await Promise.all([
          getFollowingForMentions(),
          getUserInfo(),
        ]);

        // Set current user id so we can avoid suggesting self in mentions
        const meId = getCurrentUserId(me);
        setCurrentUserId(meId);

        if (response && typeof response === 'object' && 'success' in response) {
          if ((response as any).success) {
            setFollowing((response as any).following || []);
            return;
          }
        }
        if (Array.isArray(response)) {
          setFollowing(response as any);
          return;
        }
        if (response && typeof response === 'object') {
          const maybeUsers = (response as any).following || (response as any).users || (response as any).results;
          if (Array.isArray(maybeUsers)) {
            setFollowing(maybeUsers);
            return;
          }
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

    // Use current cursor position to detect the right mention segment
    const caret = selection?.start ?? text.length;
    const lastAtIndex = text.lastIndexOf('@', Math.max(0, caret - 1));

    if (lastAtIndex !== -1) {
      const textFromAtToCaret = text.substring(lastAtIndex + 1, caret);
      // If there is a space/newline before caret, we're not in a mention token
      if (textFromAtToCaret.includes(' ') || textFromAtToCaret.includes('\n')) {
        setShowSuggestions(false);
        setMentionQuery('');
        setMentionStart(-1);
        return;
      }

      setMentionStart(lastAtIndex);
      setMentionQuery(textFromAtToCaret);
      setShowSuggestions(true);
      // Measure position and then notify parent
      updateDropdownPosition();
      setTimeout(() => {
        // Get fresh position after measurement
        const handle = findNodeHandle(containerRef.current);
        if (handle) {
          UIManager.measure(handle, (x, y, w, h, pageX, pageY) => {
            onSuggestionsChange?.(true, { x: pageX, y: pageY, width: w, height: h });
          });
        } else {
          onSuggestionsChange?.(true, inputPosition);
        }
      }, 100);
      const queryLower = textFromAtToCaret.toLowerCase();
      const filteredSuggestions = following.filter(user => {
        const id = (user as any)?.user_id ?? (user as any)?.id;
        const matches =
          (user.name || '').toLowerCase().includes(queryLower) ||
          (user.f_name || '').toLowerCase().includes(queryLower) ||
          (user.l_name || '').toLowerCase().includes(queryLower);
        // Do not suggest the current user themself
        const isSelf = !!currentUserId && !!id && id === currentUserId;
        return matches && !isSelf;
      });
      setSuggestions(filteredSuggestions);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      onSuggestionsChange?.(false);
      setMentionQuery('');
      setMentionStart(-1);
    }
  };

  // Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        // When keyboard is visible, always show dropdown above
        setDropdownAbove(true);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Measure and decide where to place dropdown to avoid clipping
  const updateDropdownPosition = () => {
    try {
      const handle = findNodeHandle(containerRef.current);
      if (!handle) return;
      UIManager.measure(handle, (x, y, w, h, pageX, pageY) => {
        const windowHeight = Dimensions.get('window').height;
        const spaceBelow = windowHeight - (pageY + h);
        // Always place above when keyboard is visible, otherwise check space
        if (isKeyboardVisible) {
          setDropdownAbove(true);
        } else {
          // If less than ~220px below (typical dropdown max height), place above
          setDropdownAbove(spaceBelow < 220);
        }
        // Store input position for scroll calculations
        setInputPosition({ x: pageX, y: pageY, width: w, height: h });
      });
    } catch {}
  };

  useEffect(() => {
    if (showSuggestions) {
      updateDropdownPosition();
      // Force dropdown above when keyboard is visible
      if (isKeyboardVisible) {
        setDropdownAbove(true);
      }
    }
  }, [showSuggestions, isKeyboardVisible, currentUserId]);

  // Handle suggestion selection
  const selectSuggestion = (user: User) => {
    // In some edge cases (focus/blur, fallback search) mentionStart can be -1
    // even though the suggestions list is visible. Recover by finding the last
    // "@" before the caret so tapping a suggestion still works.
    let effectiveMentionStart = mentionStart;
    if (effectiveMentionStart === -1) {
      const caret = selection?.start ?? value.length;
      const lastAtIndex = value.lastIndexOf('@', Math.max(0, caret - 1));
      if (lastAtIndex === -1) {
        return; // No valid "@" token to replace
      }
      effectiveMentionStart = lastAtIndex;
    }

    const caretStart = selection?.start ?? value.length;
    const caretEnd = selection?.end ?? caretStart;

    // Replace the mention token from '@' to caret with selected user name
    const beforeMention = value.substring(0, effectiveMentionStart);
    const afterCaret = value.substring(caretEnd);
    // Build mention token using the full display name with spaces (e.g. "@Harley Dave Chavez ")
    // The rendering helper will detect the mention and only highlight the name portion.
    const displayName = (user.name || formatUserFullName(user)).trim();
    const insert = `@${displayName} `;
    const newValue = beforeMention + insert + afterCaret;
    onChange(newValue);

    // Move cursor right after the inserted mention
    const newCaret = beforeMention.length + insert.length;
    setSelection({ start: newCaret, end: newCaret });

    setShowSuggestions(false);
    onSuggestionsChange?.(false);
    setMentionStart(-1);
    setMentionQuery('');

    // Focus back to text input
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 0);
  };

  // Fallback: if local following filter yields no results, try server search
  useEffect(() => {
    let cancelled = false;
    const runFallbackSearch = async () => {
      if (!showSuggestions) return;
      if (!mentionQuery) return;
      if (suggestions.length > 0) return;
      try {
        // Lazy import to avoid circular deps at top
        const { searchAlumni } = await import('../services/api');
        const res: any = await searchAlumni(mentionQuery);
        const results: any[] = (res?.results || res?.users || []);
        if (!cancelled && Array.isArray(results) && results.length) {
          const mapped = results.map((u: any) => ({
            user_id: u.user_id || u.id,
            name: u.name || formatUserFullName(u),
            f_name: u.f_name || u.first_name || '',
            m_name: u.m_name || u.middle_name || '',
            l_name: u.l_name || u.last_name || '',
            profile_pic: u.profile_pic || u.avatar_url || ''
          })) as User[];
          const filtered = mapped.filter((user) => {
            const id = (user as any)?.user_id ?? (user as any)?.id;
            const isSelf = !!currentUserId && !!id && id === currentUserId;
            return !isSelf;
          });
          setSuggestions(filtered);
        }
      } catch {}
    };
    runFallbackSearch();
    return () => { cancelled = true; };
  }, [showSuggestions, mentionQuery, suggestions.length, currentUserId]);

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
        onSuggestionsChange?.(false);
        setMentionQuery('');
        break;
    }
  };

  return (
    <View ref={containerRef} style={[styles.container, style]}>
      <TextInput
        ref={textInputRef}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        editable={!disabled}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          styles.textInput,
          textInputStyle, // Apply custom TextInput styles
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
              updateDropdownPosition();
              // Measure position and then notify parent
              setTimeout(() => {
                const handle = findNodeHandle(containerRef.current);
                if (handle) {
                  UIManager.measure(handle, (x, y, w, h, pageX, pageY) => {
                    onSuggestionsChange?.(true, { x: pageX, y: pageY, width: w, height: h });
                  });
                } else {
                  onSuggestionsChange?.(true, inputPosition);
                }
              }, 100);
              const filteredSuggestions = following.filter(user => {
                const id = (user as any)?.user_id ?? (user as any)?.id;
                const matches =
                  (user.name || '').toLowerCase().includes(textAfterAt.toLowerCase()) ||
                  (user.f_name || '').toLowerCase().includes(textAfterAt.toLowerCase()) ||
                  (user.l_name || '').toLowerCase().includes(textAfterAt.toLowerCase());
                const isSelf = !!currentUserId && !!id && id === currentUserId;
                return matches && !isSelf;
              });
              setSuggestions(filteredSuggestions);
              setSelectedIndex(0);
            }
          }
          updateDropdownPosition();
        }}
        onBlur={() => {
          // Do not immediately hide suggestions on blur; they will be closed
          // explicitly when a suggestion is selected or when typing cancels
          // the mention token. This avoids a race where the blur fires before
          // the suggestion onPress handler on some devices.
        }}
      />
      
      {/* Mention Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={dropdownAbove ? styles.suggestionsContainerAbove : styles.suggestionsContainerBelow}>
          <ScrollView style={styles.suggestionsScroll} keyboardShouldPersistTaps="always">
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
                    {formatUserFullName(user)}
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
  suggestionsContainerBelow: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e4e6ea',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    maxHeight: 300,
    marginTop: 4,
  },
  suggestionsContainerAbove: {
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

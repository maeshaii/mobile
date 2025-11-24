import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Image, Modal, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchUsersForMessaging, createConversation } from '../../services/api';
import { formatUserFullName } from '../../utils/nameUtils';
import UserAvatar from '../../components/UserAvatar';

type UserRow = { 
  user_id: number; 
  f_name: string; 
  m_name?: string | null;
  middle_name?: string | null;
  l_name: string;
  avatar_url?: string | null;
  profile_pic?: string | null;
  profile?: {
    profile_pic?: string | null;
  } | null;
};

const SearchMessagesScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState<number | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Debounced search - auto-search as user types (matching web implementation)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = q.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await searchUsersForMessaging(trimmedQuery);
        // Normalize user data to ensure all fields are present
        const normalizedUsers = (data.users || []).map((user: any) => ({
          ...user,
          m_name: user.m_name || user.middle_name || null,
          avatar_url: user.avatar_url || user.profile_pic || user.profile?.profile_pic || null,
        }));
        console.log('[Search] Normalized users:', normalizedUsers);
        setResults(normalizedUsers);
        setError(null);
      } catch (err) {
        console.error('Search failed:', err);
        setError('Search failed. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce (matching web)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [q]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  const startConversation = async (user: UserRow) => {
    if (isCreatingConversation) return;
    
    setIsCreatingConversation(user.user_id);
    setError(null);
    
    try {
      const convo = await createConversation(user.user_id);
      router.replace({ 
        pathname: '/messages/chatmessage', 
        params: { 
          conversationId: String(convo.conversation_id || convo.id), 
          name: formatUserFullName(user) 
        } 
      });
    } catch (e) {
      console.error('Create conversation failed:', e);
      setError('Failed to start conversation. Please try again.');
      setIsCreatingConversation(null);
    }
  };

  const renderEmptyState = () => {
    if (q.trim().length < 2) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🔍</Text>
          <Text style={styles.emptyStateTitle}>Start typing to search</Text>
          <Text style={styles.emptyStateMessage}>
            Enter at least 2 characters to find users
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#1C4E80" />
          <Text style={[styles.emptyStateMessage, { marginTop: 12 }]}>
            Searching...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>👤</Text>
        <Text style={styles.emptyStateTitle}>No users found</Text>
        <Text style={styles.emptyStateMessage}>
          No users found matching "{q}". Try a different search term.
        </Text>
      </View>
    );
  };

  const renderUserItem = ({ item }: { item: UserRow }) => {
    const isCreating = isCreatingConversation === item.user_id;
    
    return (
      <TouchableOpacity
        style={[styles.userItem, isCreating && styles.userItemCreating]}
        onPress={() => !isCreating && startConversation(item)}
        disabled={isCreating}
      >
        <UserAvatar
          profilePic={item.avatar_url || item.profile_pic || item.profile?.profile_pic || null}
          firstName={item.f_name}
          lastName={item.l_name}
          size={48}
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {formatUserFullName(item)}
          </Text>
          <Text style={styles.userSubtitle}>
            Tap to start chatting
          </Text>
        </View>
        <View style={styles.userAction}>
          {isCreating ? (
            <ActivityIndicator size="small" color="#1C4E80" />
          ) : (
            <FontAwesome name="chevron-right" size={16} color="#999" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Start New Conversation</Text>
          <Text style={styles.headerSubtitle}>
            Search for users to start a conversation
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.closeButton}
        >
          <FontAwesome name="times" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <FontAwesome name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search by name..."
            placeholderTextColor="#999"
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <TouchableOpacity
              onPress={() => setQ('')}
              style={styles.clearButton}
            >
              <FontAwesome name="times-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        {q.length > 0 && q.length < 2 && (
          <Text style={styles.searchHint}>
            Type at least 2 characters to search
          </Text>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-circle" size={16} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {loading && results.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1C4E80" />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={renderUserItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.resultsList}
        />
      ) : (
        renderEmptyState()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcc',
  },
  errorText: {
    fontSize: 14,
    color: '#dc3545',
    marginLeft: 8,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userItemCreating: {
    opacity: 0.6,
  },
  userAvatar: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  userSubtitle: {
    fontSize: 13,
    color: '#999',
  },
  userAction: {
    marginLeft: 12,
    width: 24,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SearchMessagesScreen;

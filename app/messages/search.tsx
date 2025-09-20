import React, { useCallback, useState } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { searchUsersForMessaging, createConversation } from '../../services/api';

type UserRow = { user_id: number; f_name: string; l_name: string };

const SearchMessagesScreen = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (query.length < 2) return;
    setLoading(true);
    try {
      const data = await searchUsersForMessaging(query);
      setResults((data?.users || []) as UserRow[]);
    } catch (e) {
      console.warn('Search failed', e);
    } finally {
      setLoading(false);
    }
  }, [q]);

  const startConversation = async (user: UserRow) => {
    try {
      const convo = await createConversation(user.user_id);
      router.replace({ pathname: '/messages/chatmessage', params: { conversationId: String(convo.conversation_id), name: `${user.f_name} ${user.l_name}` } });
    } catch (e) {
      console.warn('Create conversation failed', e);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search users..."
        value={q}
        onChangeText={setQ}
        onSubmitEditing={runSearch}
        returnKeyType="search"
      />
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.user_id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => startConversation(item)}>
            <Text style={styles.name}>{item.f_name} {item.l_name}</Text>
            <Text style={styles.action}>{loading ? '' : 'Start chat'}</Text>
          </TouchableOpacity>
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    padding: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    color: '#222',
  },
  action: {
    color: '#1C4E80',
    fontSize: 14,
  },
});

export default SearchMessagesScreen;




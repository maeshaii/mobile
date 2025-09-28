import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';
import { listConversations } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

type Row = {
  id: number;
  name: string;
  lastMessage: string;
  date: string;
  profilePic?: string;
  firstName?: string;
  lastName?: string;
  unread: number;
};

const MessageScreen = () => {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listConversations();
      const mapped: Row[] = (data || []).map((c) => {
        // Parse the full name to extract first and last names
        const fullName = c.other_participant?.name || 'Conversation';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          id: c.conversation_id,
          name: fullName,
          lastMessage: c.last_message?.content || '',
          date: new Date(c.updated_at).toLocaleDateString(),
          profilePic: c.other_participant?.avatar_url || undefined,
          firstName,
          lastName,
          unread: c.unread_count || 0,
        };
      });
      setRows(mapped);
    } catch (e) {
      console.warn('Failed to load conversations', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Reload conversations when screen comes into focus (e.g., returning from chat)
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
     
      <NavBar />
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.messageCard}
            onPress={() => router.push({ pathname: '/messages/chatmessage', params: { conversationId: String(item.id), name: item.name } })}
          >
            <UserAvatar
              profilePic={item.profilePic}
              firstName={item.firstName}
              lastName={item.lastName}
              size={44}
              style={styles.avatar}
            />
            <View style={styles.messageBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.date}>{item.date}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.message} numberOfLines={1}>{item.lastMessage}</Text>
                {item.unread > 0 && (
                  <View style={{ backgroundColor: '#1C4E80', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
      
      {/* Floating Action Button */}
      <TouchableOpacity 
        onPress={() => router.push('/messages/search' as Href)}
        style={styles.floatingButton}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>
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
  },
  topBar: {
    backgroundColor: '#1C4E80',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  topBarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 0,
    paddingLeft: 5,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 22,
    color: '#222',
    paddingLeft: 5,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#1C4E80',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 15,
    backgroundColor: '#eee',
  },
  messageBox: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  message: {
    fontSize: 13,
    color: '#333',
  },
  date: {
    fontSize: 13,
    color: '#888',
    marginLeft: 10,
    alignSelf: 'flex-start',
  },
});

export default MessageScreen;
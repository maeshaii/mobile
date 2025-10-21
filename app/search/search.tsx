import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import { API_BASE_URL, getAlumniList, listRecentSearches, addRecentSearch, clearRecentSearches } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import UserAvatar from '../../components/UserAvatar';

// Platform-specific storage utility
const isWeb = Platform.OS === 'web';

const Storage = {
  setItem: async (key: string, value: string) => {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string) => {
    if (isWeb) {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  deleteItem: async (key: string) => {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

const samplePic = require('../../assets/images/sample_pic.jpg');

export default function SearchPage() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const router = useRouter();
  const [recent, setRecent] = useState<any[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getAlumniList();
        const mapped = (data.alumni || []).map((a: any) => {
          // Split the name into first and last name
          const nameParts = (a.name || '').trim().split(' ');
          const f_name = nameParts[0] || '';
          const l_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          
          console.log('Alumni data:', a.name, 'Profile pic:', a.profile_pic);
          
          return {
            id: String(a.id),
            name: a.name,
            f_name: f_name,
            l_name: l_name,
            profile_pic: a.profile_pic,
            time: '',
          };
        });
        setUsers(mapped);
        // Load recent searches - prefer server, fall back to local cache
        try {
          const serverRecent = await listRecentSearches(10);
          if (Array.isArray(serverRecent) && serverRecent.length) {
            // Map to UI shape
            const mappedRecent = serverRecent.map((u: any) => ({
              id: String(u.user_id),
              name: `${u.f_name || ''} ${u.l_name || ''}`.trim() || 'User',
              f_name: u.f_name,
              l_name: u.l_name,
              profile_pic: u.profile_pic,
              time: '',
            }));
            setRecent(mappedRecent);
            // Also persist locally for offline
            await Storage.setItem('recentSearches', JSON.stringify(mappedRecent));
          } else {
            const raw = await Storage.getItem('recentSearches');
            if (raw) setRecent(JSON.parse(raw));
          }
        } catch {
          try {
            const raw = await Storage.getItem('recentSearches');
            if (raw) setRecent(JSON.parse(raw));
          } catch {}
        }
      } catch (e) {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveRecent = async (items: any[]) => {
    setRecent(items);
    try { await Storage.setItem('recentSearches', JSON.stringify(items)); } catch {}
  };

  const handleOpenUser = async (item: any) => {
    if (selecting) {
      // Toggle selection in select mode
      const key = String(item.id);
      setSelectedIds(prev => ({ ...prev, [key]: !prev[key] }));
      return;
    }
    // Update backend recent searches and immediately sync from server
    try {
      await addRecentSearch(Number(item.id));
      try {
        const serverRecent = await listRecentSearches(10);
        if (Array.isArray(serverRecent)) {
          const mappedRecent = serverRecent.map((u: any) => ({
            id: String(u.user_id),
            name: `${u.f_name || ''} ${u.l_name || ''}`.trim() || 'User',
            f_name: u.f_name,
            l_name: u.l_name,
            profile_pic: u.profile_pic,
            time: '',
          }));
          await saveRecent(mappedRecent);
        }
      } catch {}
    } catch {
      // Fallback: update local list: unique by id, most recent first, cap 10
      const existingIndex = recent.findIndex(r => String(r.id) === String(item.id));
      const updated = [item, ...recent.filter((_, idx) => idx !== existingIndex)].slice(0, 10);
      await saveRecent(updated);
    }
    router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: item.id } });
  };

  const clearRecent = async () => {
    try { await clearRecentSearches(); } catch {}
    await saveRecent([]);
  };

  const startSelecting = () => {
    if (!recent.length) return;
    setSelecting(true);
    setSelectedIds({});
  };

  const cancelSelecting = () => {
    setSelecting(false);
    setSelectedIds({});
  };

  const deleteSelected = async () => {
    const remaining = recent.filter(r => !selectedIds[String(r.id)]);
    await saveRecent(remaining);
    setSelecting(false);
    setSelectedIds({});
  };

  const filteredUsers = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      {/* Search Bar */}
      <View style={styles.searchBarWrapper}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search"
          placeholderTextColor="#174f84"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {/* Recent Section */}
      <View style={styles.recentHeaderRow}>
        <Text style={styles.recentHeader}>Recent</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {selecting && (
            <TouchableOpacity onPress={cancelSelecting} accessibilityLabel="Cancel selection">
              <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              if (selecting) {
                deleteSelected();
              } else {
                startSelecting();
              }
            }}
            accessibilityLabel={selecting ? 'Delete selected recent searches' : 'Select recent searches to delete'}
          >
            <FontAwesome name={selecting ? 'check' : 'trash'} size={18} color="#174f84" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent list shown only when not searching */}
      {!search && (
        <FlatList
          data={recent}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userRow} onPress={() => handleOpenUser(item)}>
              <UserAvatar 
                profilePic={item.profile_pic}
                firstName={item.f_name}
                lastName={item.l_name}
                size={40}
                style={styles.avatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userTime}>{item.time}</Text>
              </View>
              {selecting ? (
                <FontAwesome
                  name={selectedIds[String(item.id)] ? 'check-square' : 'square-o'}
                  size={22}
                  color="#174f84"
                />
              ) : (
                <FontAwesome name="angle-right" size={22} color="#174f84" />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={!loading ? (
            <Text style={{ color: '#888', paddingHorizontal: 16 }}>No recent searches</Text>
          ) : null}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      )}

      {/* Users List (only show when searching) */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        !!search && (
          <FlatList
            data={filteredUsers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userRow} onPress={() => handleOpenUser(item)}>
                <UserAvatar 
                  profilePic={item.profile_pic}
                  firstName={item.f_name}
                  lastName={item.l_name}
                  size={40}
                  style={styles.avatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userTime}>{item.time}</Text>
                </View>
                <FontAwesome name="angle-right" size={22} color="#174f84" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={{ color: '#888', paddingHorizontal: 16 }}>No results</Text>}
            contentContainerStyle={{ paddingBottom: 30 }}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 0,
  },
  searchBarWrapper: {
    backgroundColor: '#174f84',
    padding: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 40,
  },
  searchBar: {
    backgroundColor: '#e3ecf7',
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 40,
    fontSize: 16,
    color: '#174f84',
    marginLeft: 50,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },
  recentHeader: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#222',
  },
  seeAll: {
    color: '#174f84',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#ccc',
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
  },
  userTime: {
    fontSize: 12,
    color: '#888',
  },
  menuBtn: {
    padding: 8,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 5,
    borderRadius: 10,
  },
});

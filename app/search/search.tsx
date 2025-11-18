import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import { API_BASE_URL, getAlumniList, listRecentSearches, addRecentSearch, clearRecentSearches, searchAlumni, searchOJT, getAccessToken } from '../../services/api';
import { RecentSearchWebSocket } from '../../services/recentSearchWebSocket';
import * as SecureStore from 'expo-secure-store';
import UserAvatar from '../../components/UserAvatar';
import { formatUserFullName } from '../../utils/nameUtils';

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
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const router = useRouter();
  const [recent, setRecent] = useState<any[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const formatRecentSearches = React.useCallback((serverRecent: any[]) => {
    return serverRecent.map((u: any) => ({
      id: String(u.user_id ?? u.searched_user?.user_id ?? u.id),
      name: formatUserFullName(u.searched_user || u) || 'User',
      f_name: u.f_name || u.searched_user?.f_name,
      l_name: u.l_name || u.searched_user?.l_name,
      profile_pic: u.profile_pic || u.searched_user?.profile_pic,
      time: '',
    }));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Load recent searches - prefer server, fall back to local cache
        try {
          const serverRecent = await listRecentSearches(10);
          if (Array.isArray(serverRecent) && serverRecent.length) {
            // Map to UI shape
            const mappedRecent = formatRecentSearches(serverRecent);
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
  }, [formatRecentSearches]);

  // Handle search when query changes - search both alumni and OJT
  useEffect(() => {
    const performSearch = async () => {
      if (!search || search.trim().length < 2) {
        setUsers([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        // Search both alumni and OJT in parallel
        const [alumniResults, ojtResults] = await Promise.all([
          searchAlumni(search.trim()).catch(() => ({ results: [] })),
          searchOJT(search.trim()).catch(() => ({ users: [] }))
        ]);

        // Combine results from both searches
        const combinedResults: any[] = [];

        // Add alumni results
        if (alumniResults.results && Array.isArray(alumniResults.results)) {
          alumniResults.results.forEach((u: any) => {
            combinedResults.push({
              id: String(u.id || u.user_id),
              name: u.name || formatUserFullName(u),
              f_name: u.f_name || u.first_name || '',
              l_name: u.l_name || u.last_name || '',
              profile_pic: u.profile_pic || null,
              time: '',
            });
          });
        }

        // Add OJT results
        if (ojtResults.users && Array.isArray(ojtResults.users)) {
          ojtResults.users.forEach((u: any) => {
            combinedResults.push({
              id: String(u.user_id),
              name: formatUserFullName({ first_name: u.first_name, last_name: u.last_name }) || u.username || 'OJT User',
              f_name: u.first_name || '',
              l_name: u.last_name || '',
              profile_pic: u.profile_pic || null,
              time: '',
            });
          });
        }

        // Remove duplicates based on user ID
        const uniqueResults = combinedResults.filter((user, index, self) =>
          index === self.findIndex((u) => u.id === user.id)
        );

        setUsers(uniqueResults);
      } catch (error) {
        console.error('Search error:', error);
        setUsers([]);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [search]);

  const saveRecent = React.useCallback(async (items: any[]) => {
    setRecent(items);
    try { await Storage.setItem('recentSearches', JSON.stringify(items)); } catch {}
  }, []);

  useEffect(() => {
    let ws: RecentSearchWebSocket | null = null;
    let isMounted = true;

    const setupWebSocket = async () => {
      try {
        const token = await getAccessToken();
        ws = new RecentSearchWebSocket(API_BASE_URL, token || undefined);
        ws.onEvent((event) => {
          if (event.type === 'recent_search_update') {
            const normalized = formatRecentSearches(
              event.recent_searches ?? event.recent ?? []
            );
            if (isMounted) {
              void saveRecent(normalized);
            }
          }
        });
        ws.connect().catch((err) => console.warn('Recent search WS connect failed:', err));
      } catch (error) {
        console.warn('Recent search WS setup failed:', error);
      }
    };

    setupWebSocket();

    return () => {
      isMounted = false;
      if (ws) {
        ws.disconnect();
      }
    };
  }, [formatRecentSearches, saveRecent]);

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
          const mappedRecent = formatRecentSearches(serverRecent);
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

  const selectAllRecent = () => {
    const selectedCount = Object.values(selectedIds).filter(Boolean).length;
    const totalCount = recent.length;
    
    if (selectedCount === totalCount) {
      // If all are selected, deselect all
      setSelectedIds({});
    } else {
      // Select all
      const allSelected: Record<string, boolean> = {};
      recent.forEach(item => {
        allSelected[String(item.id)] = true;
      });
      setSelectedIds(allSelected);
    }
  };

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
        <Text style={styles.recentHeader}>
          Recent{selecting && ` (${Object.values(selectedIds).filter(Boolean).length}/${recent.length} selected)`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {selecting && (
            <>
              <TouchableOpacity onPress={selectAllRecent} accessibilityLabel="Select all recent searches">
                <Text style={{ color: '#174f84', fontWeight: 'bold' }}>
                  {Object.values(selectedIds).filter(Boolean).length === recent.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelSelecting} accessibilityLabel="Cancel selection">
                <Text style={{ color: '#174f84', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
            </>
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
      {searching ? (
        <View style={{ paddingTop: 20, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#174f84" />
        </View>
      ) : (
        !!search && (
          <FlatList
            data={users}
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

import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, getAlumniList } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

const samplePic = require('../../assets/images/sample_pic.jpg');

export default function SearchPage() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const router = useRouter();

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
      } catch (e) {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredUsers = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : users;

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
        <TouchableOpacity>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      {/* Users List */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userRow} onPress={() => router.push({ pathname: '/otheruser/otheruser', params: { viewUserId: item.id } })}>
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
          contentContainerStyle={{ paddingBottom: 30 }}
        />
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
    fontSize: 16,
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

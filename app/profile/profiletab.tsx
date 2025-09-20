import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Alert } from 'react-native';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { useRouter } from 'expo-router';
import { API_BASE_URL, getUserInfo } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const profilePic = require('../../assets/images/sample_pic.jpg');
const cciLogo = require('../../assets/images/ccict_logo.jpg');
const pesoLogo = require('../../assets/images/peso_logo.jpg');
const forumLogo = require('../../assets/images/wny_logo.jpg');

const menuItems = [
  { label: 'CCICT', icon: cciLogo },
  { label: 'Peso', icon: pesoLogo },
  { label: 'CCICT Forum', icon: forumLogo },
  { label: 'Settings', icon: <FontAwesome name="cog" size={24} color="#222" /> },
  { label: 'Log out', icon: <MaterialIcons name="logout" size={24} color="#222" /> },
];

interface UserProfile {
  name?: string;
  username?: string;
  profile_pic?: string;
}

export default function ProfileTab() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const userInfo = await getUserInfo();
      setUser(userInfo);
    } catch (e) {
      setUser(null);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);
  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [fetchUser])
  );

  return (
    <View style={styles.container}>
      <NavBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Profile Card */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.8} onPress={() => router.push('/profile/profilepage')}>
          <Image 
            source={user?.profile_pic 
              ? { uri: String(user.profile_pic).startsWith('http') ? String(user.profile_pic) : `${API_BASE_URL}${user.profile_pic}` }
              : profilePic}
            style={styles.profileAvatar} 
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.profileName}>{user?.name || 'Your Name'}</Text>
            <Text style={styles.profileUsername}>{user?.username || '@username'}</Text>
          </View>
          {/* <TouchableOpacity style={styles.profileActionBtn}>
            <FontAwesome name="plus" size={18} color="#222" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileDropdownBtn}>
            <FontAwesome name="chevron-down" size={18} color="#222" />
          </TouchableOpacity> */}
        </TouchableOpacity>

        {/* Menu Items */}
        {menuItems.map((item, idx) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuCard}
            onPress={() => {
              if (item.label === 'Log out') router.push('/logout');
              else if (item.label === 'CCICT') router.push('/ccict/ccictpage');
              else if (item.label === 'Peso') router.push('/peso/pesopage');
              else if (item.label === 'CCICT Forum') router.push('/forum/forumpage');
              // else if (item.label === 'Donation') router.push('/donation/donationpage');
              else if (item.label === 'Settings') router.push('/settings/settings');
            }}
          >
            {typeof item.icon === 'number' ? (
              <Image source={item.icon} style={styles.menuIcon} />
            ) : (
              <View style={styles.menuIcon}>{item.icon}</View>
            )}
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  profileCardTouchable: {
    // This style can be used for TouchableOpacity wrapping the profile card
    // Add any additional touch feedback or shadow if needed
    // For now, just spread the profileCard style
    // If you want a scale effect, use Animated.View or TouchableOpacity's activeOpacity
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eee',
  },
  profileName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
  },
  profileUsername: {
    fontSize: 13,
    color: '#4B86A6',
    marginTop: 2,
  },
  profileActionBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 8,
    marginLeft: 8,
  },
  profileDropdownBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 8,
    marginLeft: 8,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  menuIcon: {
    width: 32,
    height: 32,
    marginRight: 16,
    resizeMode: 'contain',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
});

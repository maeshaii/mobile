import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Alert } from 'react-native';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { API_BASE_URL, getUserInfo } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import UserAvatar from '../../components/UserAvatar';

const profilePic = require('../../assets/images/sample_pic.jpg');
const cciLogo = require('../../assets/images/ccict_logo.jpg');
const pesoLogo = require('../../assets/images/peso_logo.jpg');

const allMenuItems = [
  { label: 'Rewards', icon: <FontAwesome name="gift" size={24} color="#222" /> },
  { label: 'CCICT', icon: cciLogo },
  { label: 'Peso', icon: pesoLogo },
  { label: 'Forum', icon: <MaterialIcons name="people" size={24} color="#222" /> },
  { label: 'Donation', icon: <FontAwesome name="heart" size={24} color="#222" /> },
  { label: 'Settings', icon: <FontAwesome name="cog" size={24} color="#222" /> },
  { label: 'Log out', icon: <MaterialIcons name="logout" size={24} color="#222" /> },
];

interface UserProfile {
  name?: string;
  username?: string;
  ctu_id?: string | number;
  acc_username?: string;
  profile_pic?: string;
  f_name?: string;
  l_name?: string;
  account_type?: {
    ojt?: boolean;
    admin?: boolean;
    peso?: boolean;
    user?: boolean;
    coordinator?: boolean;
  };
  role?: string;
  user_type?: string;
}

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [menuItems, setMenuItems] = useState(allMenuItems);

  const fetchUser = useCallback(async () => {
    try {
      const userInfo = await getUserInfo();
      setUser(userInfo);
      
      // Filter menu items based on user type
      const isOJT = userInfo?.account_type?.ojt || userInfo?.role === 'ojt' || userInfo?.user_type === 'ojt';
      
      if (isOJT) {
        // Hide Forum and Donation for OJT users
        const filteredItems = allMenuItems.filter(item => 
          item.label !== 'Forum' && item.label !== 'Donation'
        );
        setMenuItems(filteredItems);
      } else {
        // Show all items for non-OJT users
        setMenuItems(allMenuItems);
      }
    } catch (e) {
      console.error('ProfileTab - Error fetching user info:', e);
      setUser(null);
      setMenuItems(allMenuItems);
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
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Menu</Text>
      </View>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 100, // Extra padding for navbar (60-70px) + safe area
          paddingTop: 8 
        }}
        showsVerticalScrollIndicator={true}
      >
        {/* Profile Card */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.8} onPress={() => router.push('/profile/profilepage')}>
          <UserAvatar
            profilePic={user?.profile_pic}
            firstName={user?.f_name}
            lastName={user?.l_name}
            size={60}
            style={styles.profileAvatar}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.profileName}>{user?.name || 'Your Name'}</Text>
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
              else if (item.label === 'Rewards') router.push('/rewards/rewards');
              else if (item.label === 'CCICT') router.push('/ccict/ccictpage');
              else if (item.label === 'Peso') router.push('/peso/pesopage');
              else if (item.label === 'Forum') router.push('/forum/forumpage');
              else if (item.label === 'Donation') router.push('/donation/donationpage');
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
      <NavBar />
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
  scrollView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#222',
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

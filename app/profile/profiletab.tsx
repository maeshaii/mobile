import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { API_BASE_URL, getUserInfo, getAdminPesoUsers, getAlumniDetails } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import UserAvatar from '../../components/UserAvatar';

const allMenuItems = [
  { label: 'Rewards', icon: <FontAwesome name="gift" size={24} color="#222" /> },
  { label: 'CCICT', icon: null, useAvatar: true },
  { label: 'Peso', icon: null, useAvatar: true },
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

interface AdminPesoProfile {
  profile_pic?: string | null;
  f_name?: string;
  l_name?: string;
}

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [menuItems, setMenuItems] = useState(allMenuItems);
  // Keep this false so we render immediately and refresh quietly in the background
  const [menuLoading, setMenuLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState<AdminPesoProfile | null>(null);
  const [pesoProfile, setPesoProfile] = useState<AdminPesoProfile | null>(null);

  /**
   * Load admin + PESO profiles with a single getAdminPesoUsers() call.
   * This avoids extra network round‑trips every time you open the Profile tab.
   */
  const loadAdminAndPesoProfiles = useCallback(async () => {
    try {
      const adminPesoUsersData = await getAdminPesoUsers();

      const adminUserIds = adminPesoUsersData.admin_user_ids || [];
      const pesoUserIds = adminPesoUsersData.peso_user_ids || [];

      const adminUserId = adminUserIds[0];
      const pesoUserId = pesoUserIds[0];

      const [adminDetailsResponse, pesoDetailsResponse] = await Promise.all([
        adminUserId ? getAlumniDetails(adminUserId) : Promise.resolve(null),
        pesoUserId ? getAlumniDetails(pesoUserId) : Promise.resolve(null),
      ]);

      const adminDetails = (adminDetailsResponse as any)?.alumni || adminDetailsResponse || {};
      const pesoDetails = (pesoDetailsResponse as any)?.alumni || pesoDetailsResponse || {};

      if (adminUserId && adminDetails) {
        setAdminProfile({
          profile_pic: adminDetails?.profile_pic
            ? (String(adminDetails.profile_pic).startsWith('http') || String(adminDetails.profile_pic).startsWith('data:'))
              ? adminDetails.profile_pic
              : `${API_BASE_URL}${adminDetails.profile_pic}`
            : null,
          f_name: adminDetails?.first_name || adminDetails?.f_name || '',
          l_name: adminDetails?.last_name || adminDetails?.l_name || '',
        });
      }

      if (pesoUserId && pesoDetails) {
        setPesoProfile({
          profile_pic: pesoDetails?.profile_pic
            ? (String(pesoDetails.profile_pic).startsWith('http') || String(pesoDetails.profile_pic).startsWith('data:'))
              ? pesoDetails.profile_pic
              : `${API_BASE_URL}${pesoDetails.profile_pic}`
            : null,
          f_name: pesoDetails?.first_name || pesoDetails?.f_name || '',
          l_name: pesoDetails?.last_name || pesoDetails?.l_name || '',
        });
      }
    } catch (error) {
      console.error('ProfileTab - Error loading admin/PESO profiles:', error);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      // Don't block initial render; just refresh quietly.
      setMenuLoading(true);
      const userInfo = await getUserInfo();
      setUser(userInfo);
      
      // Load admin and PESO profiles
      await loadAdminAndPesoProfiles();
      
      // Determine account type flags
      const isOjt = !!(
        userInfo?.account_type?.ojt ||
        userInfo?.role === 'ojt' ||
        userInfo?.user_type === 'ojt'
      );
      const isAlumni = !!userInfo?.account_type?.user && !isOjt;
      
      // Forum and Donation are **only** for pure alumni accounts (never for OJT)
      const filteredItems = isAlumni
        ? allMenuItems
        : allMenuItems.filter(item => item.label !== 'Forum' && item.label !== 'Donation');
      
      setMenuItems(filteredItems);
    } catch (e) {
      console.error('ProfileTab - Error fetching user info:', e);
      setUser(null);
      // Safe default: hide Forum & Donation if we can't identify the account type
      setMenuItems(allMenuItems.filter(item => item.label !== 'Forum' && item.label !== 'Donation'));
    } finally {
      setMenuLoading(false);
    }
  }, [loadAdminAndPesoProfiles]);

  // Load once on mount so the first visit is fast and cached
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // On focus, refresh in the background but keep existing UI visible
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
        {menuItems.map((item, idx) => {
          // Handle CCICT and PESO with UserAvatar
          if (item.label === 'CCICT' && item.useAvatar) {
            return (
              <TouchableOpacity
                key={item.label}
                style={styles.menuCard}
                onPress={() => router.push('/ccict/ccictpage')}
              >
                <View style={styles.menuIcon}>
                  <UserAvatar
                    profilePic={adminProfile?.profile_pic}
                    firstName={adminProfile?.f_name}
                    lastName={adminProfile?.l_name}
                    size={32}
                  />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          }
          
          if (item.label === 'Peso' && item.useAvatar) {
            return (
              <TouchableOpacity
                key={item.label}
                style={styles.menuCard}
                onPress={() => router.push('/peso/pesopage')}
              >
                <View style={styles.menuIcon}>
                  <UserAvatar
                    profilePic={pesoProfile?.profile_pic}
                    firstName={pesoProfile?.f_name}
                    lastName={pesoProfile?.l_name}
                    size={32}
                  />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          }
          
          // Handle other menu items with icons
          return (
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
              <View style={styles.menuIcon}>{item.icon}</View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
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

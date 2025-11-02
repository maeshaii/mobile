import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { FontAwesome, MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // ✅ Use useRouter from expo-router
import { getUserInfo } from '../../services/api';
import { useRealTimeMessages } from '../../hooks/useRealTimeMessages';

const NavBar = () => {
  const router = useRouter(); // ✅ This replaces useNavigation()
  const [user, setUser] = useState<any>(null);

  // Use real-time messages hook
  const { unreadCount: messageUnreadCount } = useRealTimeMessages({
    enablePolling: true,
    pollingInterval: 30000,
    autoConnect: true
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userInfo = await getUserInfo();
        setUser(userInfo);
      } catch (err) {
        // Fallback to localStorage for OJT users
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            setUser(JSON.parse(userStr));
          }
        } catch (localErr) {
          console.error('Error loading user:', localErr);
        }
      }
    };
    loadUser();
  }, []);

  const handleHomePress = () => {
    // Check if user is OJT and redirect accordingly
    const isOJT = user?.account_type?.ojt || user?.role === 'ojt' || user?.user_type === 'ojt';
    console.log('🔍 NAVBAR DEBUG: User object:', user);
    console.log('🔍 NAVBAR DEBUG: Is OJT:', isOJT);
    
    if (isOJT) {
      console.log('🔍 NAVBAR DEBUG: Navigating to OJT dashboard');
      router.push('/ojt/ojtpage');
    } else {
      console.log('🔍 NAVBAR DEBUG: Navigating to regular home');
      router.push('/homepage/home');
    }
  };

  return (
    <View style={styles.navBarContainer}>

      {/* Navigation Icons */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={handleHomePress}>
          <FontAwesome name="home" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/search/search')}>
        <FontAwesome name="search" size={16} color="white" style={styles.searchIcon} />
      </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/notifications/notification')}>
          <FontAwesome name="bell" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/messages/message')} style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="email" size={24} color="white" />
          {messageUnreadCount > 0 && (
            <View style={styles.messageBadge}>
              <Text style={styles.messageBadgeText}>
                {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/profile/profiletab')}>
          <Feather name="user" size={24} color="white" />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBarContainer: {
    backgroundColor: '#1C4E80',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 40,
  },
  searchIcon: {
    marginRight: 5,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 10,
    backgroundColor: 'black',
    borderWidth: 1,
    borderColor: 'white',
  },
  messageBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#ff3b3b',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#1C4E80',
    zIndex: 10,
  },
  messageBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default NavBar;
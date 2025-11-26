import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { FontAwesome, MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // ✅ Use useRouter from expo-router
import { getUserInfo } from '../../services/api';
import { useRealTimeMessages } from '../../hooks/useRealTimeMessages';
import { useRealTimeNotifications } from '../../hooks/useRealTimeNotifications';

const NAV_ICON_SIZE = 24;
const LABEL_FONT_SIZE = 12;
const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = '#FFFFFF';

const NavBar = () => {
  const router = useRouter(); // ✅ This replaces useNavigation()
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();

  const isActive = (prefixes: string[]) => {
    if (!pathname) return false;
    return prefixes.some((p) => pathname.startsWith(p));
  };

  // Use real-time messages hook
  const { unreadCount: messageUnreadCount, messageRequestCount } = useRealTimeMessages({
    enablePolling: true,
    pollingInterval: 30000,
    autoConnect: true
  });

  // Use real-time notifications hook
  const { notificationCount } = useRealTimeNotifications({
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
          <View style={styles.iconWithLabel}>
            {isActive(['/homepage', '/ojt/ojtpage']) && <View style={styles.activeIndicator} />}
            <FontAwesome name="home" size={NAV_ICON_SIZE} color={INACTIVE_COLOR} />
            <Text style={[styles.label, isActive(['/homepage', '/ojt/ojtpage']) && styles.activeLabel]}>Home</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/search/search')}>
          <View style={styles.iconWithLabel}>
            {isActive(['/search']) && <View style={styles.activeIndicator} />}
            <FontAwesome name="search" size={NAV_ICON_SIZE} color={INACTIVE_COLOR} style={styles.searchIcon} />
            <Text style={[styles.label, isActive(['/search']) && styles.activeLabel]}>Search</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/notifications/notification')} style={{ position: 'relative' }}>
          <View style={styles.iconWithLabel}>
            {isActive(['/notifications']) && <View style={styles.activeIndicator} />}
            <FontAwesome name="bell" size={NAV_ICON_SIZE} color={INACTIVE_COLOR} />
            <Text style={[styles.label, isActive(['/notifications']) && styles.activeLabel]}>Notifications</Text>
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/messages/message')} style={{ position: 'relative' }}>
          <View style={styles.iconWithLabel}>
            {isActive(['/messages']) && <View style={styles.activeIndicator} />}
            <MaterialIcons name="email" size={NAV_ICON_SIZE} color={INACTIVE_COLOR} />
            <Text style={[styles.label, isActive(['/messages']) && styles.activeLabel]}>Messages</Text>
            {(messageUnreadCount > 0 || messageRequestCount > 0) && (
              <View style={styles.messageBadge}>
                <Text style={styles.messageBadgeText}>
                  {(messageUnreadCount + messageRequestCount) > 99 ? '99+' : (messageUnreadCount + messageRequestCount)}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/profile/profiletab')}>
          <View style={styles.iconWithLabel}>
            {isActive(['/profile']) && <View style={styles.activeIndicator} />}
            <Feather name="user" size={NAV_ICON_SIZE} color={INACTIVE_COLOR} />
            <Text style={[styles.label, isActive(['/profile']) && styles.activeLabel]}>Profile</Text>
            <View style={styles.badge} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBarContainer: {
    backgroundColor: '#1C4E80',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 10,
  },
  searchIcon: {
    marginRight: 5,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconWithLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: INACTIVE_COLOR,
    fontSize: LABEL_FONT_SIZE,
    marginTop: 4,
  },
  activeLabel: {
    color: ACTIVE_COLOR,
    fontWeight: '600',
  },
  activeIndicator: {
    height: 3,
    width: 26,
    borderRadius: 2,
    backgroundColor: ACTIVE_COLOR,
    marginBottom: 6,
  },
  badge: {
    position: 'absolute',
    bottom: 12,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 10,
    backgroundColor: 'black',
    borderWidth: 1,
    borderColor: '#FFFFFF',
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
  notificationBadge: {
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
  notificationBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default NavBar;
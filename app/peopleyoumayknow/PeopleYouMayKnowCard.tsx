import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchSuggestedUsers, followUser } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

interface SuggestedUser {
  id: number;
  name: string;
  profile_pic?: string;
  batch?: number;
  account_type: {
    admin: boolean;
    peso: boolean;
    user: boolean;
    coordinator: boolean;
    ojt: boolean;
  };
}

const { width } = Dimensions.get('window');

// Helper function to get initials from name
const getInitials = (name: string): string => {
  if (!name) return '?';
  const names = name.trim().split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

export default function PeopleYouMayKnowCard() {
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});
  const [isDismissed, setIsDismissed] = useState(false);
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});
  const router = useRouter();

  useEffect(() => {
    loadSuggestedUsers();
  }, []);

  const loadSuggestedUsers = async () => {
    try {
      setLoading(true);
      const response = await fetchSuggestedUsers();
      if (response.success) {
        // Show up to 10 users
        setSuggestedUsers((response.users || []).slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading suggested users:', error);
      // Don't show alert for this, just fail silently
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      setFollowLoading(prev => ({ ...prev, [userId]: true }));
      await followUser(userId);
      
      // Remove the user from suggestions after following
      setSuggestedUsers(prev => prev.filter(user => user.id !== userId));
      Alert.alert('Success', 'You are now following this user');
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    } finally {
      setFollowLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemove = (userId: number) => {
    Alert.alert(
      'Remove from Suggestions',
      'Are you sure you want to remove this user from your suggestions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSuggestedUsers(prev => prev.filter(user => user.id !== userId));
          },
        },
      ]
    );
  };

  const handleUserPress = (userId: number) => {
    router.push(`/otheruser/otheruser?viewUserId=${userId}`);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Don't render if dismissed or no users
  if (isDismissed || suggestedUsers.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>People You May Know</Text>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <FontAwesome name="times" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* User Cards */}
      <View style={styles.userCardsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#174f84" />
            <Text style={styles.loadingText}>Loading suggestions...</Text>
          </View>
        ) : (
          <FlatList
            data={suggestedUsers}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            snapToInterval={Math.round(width * 0.6) + 16}
            decelerationRate="fast"
            snapToAlignment="start"
            renderItem={({ item: user }) => (
              <View style={styles.userCard}>
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => handleUserPress(user.id)}
                activeOpacity={0.8}
              >
                  <UserAvatar
                    profilePic={!imageErrors[user.id] ? user.profile_pic : undefined}
                    firstName={user.name}
                    size={50}
                    style={styles.profileImage}
                  />
                  <Text style={styles.userName} numberOfLines={2}>
                    {user.name}
                  </Text>
                </TouchableOpacity>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.followButton}
                    onPress={() => handleFollow(user.id)}
                    disabled={followLoading[user.id]}
                  >
                    <FontAwesome name="plus" size={10} color="white" />
                    <Text style={styles.followButtonText}>
                      {followLoading[user.id] ? '...' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(user.id)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dismissButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  userCardsContainer: {
    padding: 16,
  },
  userCard: {
    width: Math.round(width * 0.6),
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#174f84',
  },
  initialsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    lineHeight: 16,
  },
  actionButtons: {
    width: '100%',
    gap: 6,
  },
  followButton: {
    backgroundColor: '#174f84',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  followButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#666',
    fontSize: 11,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    paddingRight: 16,
  },
});

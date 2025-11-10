import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import CachedImage from './CachedImage';
import { API_BASE_URL } from '../services/api';

interface UserAvatarProps {
  profilePic?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  style?: any;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  profilePic,
  firstName,
  lastName,
  size = 40,
  style 
}) => {
  const safeSize = Math.max(1, Math.abs(size || 40));

  const avatarStyle = {
    width: safeSize,
    height: safeSize,
    borderRadius: safeSize / 2,
  } as const;

  const buildUri = (src?: string | null) => {
    if (!src) return null;
    const s = String(src);
    const isAbs = s.startsWith('http') || s.startsWith('data:');
    return isAbs ? s : `${API_BASE_URL}${s}`;
  };

  const getInitials = () => {
    const name = `${firstName || ''} ${lastName || ''}`.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const uri = buildUri(profilePic);

  if (uri) {
    return (
      <View style={[avatarStyle, style, styles.imageContainer]}>
        <CachedImage
          uri={uri}
          style={[avatarStyle, { position: 'absolute' }]}
          contentFit="cover"
        />
      </View>
    );
  }

  // Fallback to initials when no profile picture
  return (
    <View style={[avatarStyle, style, styles.fallback]}>
      <Text style={[styles.initials, { fontSize: safeSize * 0.4 }]}>
        {getInitials()}
      </Text>
    </View>
  );
};

 

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  fallback: {
    backgroundColor: '#174f84',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: 'white',
    fontWeight: '700',
  },
});

export default UserAvatar;

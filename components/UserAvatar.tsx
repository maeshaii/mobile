import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
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
  firstName = '', 
  lastName = '', 
  size = 40,
  style 
}) => {
<<<<<<< HEAD
  const [imageError, setImageError] = useState(false);
  
=======
  // Ensure size is always positive
  const safeSize = Math.max(1, Math.abs(size || 40));
>>>>>>> 6816742e668def8e5663f81bb9f7d3d07cffb6f8
  // Generate initials from first and last name
  const getInitials = (first: string, last: string) => {
    const firstInitial = first.charAt(0).toUpperCase();
    const lastInitial = last.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  };

  const initials = getInitials(firstName, lastName);
  
  // Determine if we have a valid profile picture
  const hasValidProfilePic = profilePic && 
    profilePic.trim() !== '' && 
    profilePic !== 'null' && 
    profilePic !== 'undefined' && 
    !imageError;
  
  const avatarStyle = {
    width: safeSize,
    height: safeSize,
    borderRadius: safeSize / 2,
  };

  // Show initials if no valid profile pic or if image failed to load
  if (!hasValidProfilePic || !firstName) {
    return (
      <View style={[
        avatarStyle, 
        styles.initialsContainer, 
        style
      ]}>
        <Text style={[
          styles.initialsText, 
          { fontSize: safeSize * 0.4 }
        ]}>
          {initials || '?'}
        </Text>
      </View>
    );
  }

  // Build the image source for valid profile pics
  const imageSource: ImageSourcePropType = { 
    uri: String(profilePic).startsWith('http') || String(profilePic).startsWith('data:')
      ? String(profilePic)
      : `${API_BASE_URL}${profilePic}`
  };

  return (
    <Image 
      source={imageSource} 
      style={[avatarStyle, style]}
      resizeMode="cover"
      onError={() => {
        console.warn('Failed to load profile image:', profilePic);
        setImageError(true);
      }}
    />
  );
};

const styles = StyleSheet.create({
  initialsContainer: {
    backgroundColor: '#bcd0e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#174f84',
    fontWeight: 'bold',
  },
});

export default UserAvatar;

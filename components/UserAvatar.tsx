import React from 'react';
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
  // Generate initials from first and last name
  const getInitials = (first: string, last: string) => {
    const firstInitial = first.charAt(0).toUpperCase();
    const lastInitial = last.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  };

  const initials = getInitials(firstName, lastName);
  
  // Determine if we have a valid profile picture
  const hasValidProfilePic = profilePic && profilePic.trim() !== '' && profilePic !== 'null' && profilePic !== 'undefined';
  
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  // Always prioritize initials if no valid profile pic
  if (!hasValidProfilePic || !firstName) {
    return (
      <View style={[
        avatarStyle, 
        styles.initialsContainer, 
        style
      ]}>
        <Text style={[
          styles.initialsText, 
          { fontSize: size * 0.4 }
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
        // If image fails to load, this will cause a re-render with hasValidProfilePic = false
        console.warn('Failed to load profile image:', profilePic);
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

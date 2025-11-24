import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
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
    
    // Handle data URIs (base64 images)
    if (s.startsWith('data:')) return s;
    
    // Handle absolute URLs - check if it's localhost and replace with API_BASE_URL
    if (s.startsWith('http')) {
      // If it's a localhost URL (127.0.0.1, localhost, or 10.0.2.2), replace with API_BASE_URL
      const localhostPattern = /^https?:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?/i;
      if (localhostPattern.test(s)) {
        // Extract the path from the URL
        const urlObj = new URL(s);
        return `${API_BASE_URL}${urlObj.pathname}${urlObj.search}`;
      }
      // Otherwise use the absolute URL as-is (should be ngrok or production URL)
      return s;
    }
    
    // Handle relative URLs - prepend API_BASE_URL
    // Ensure the relative path starts with / for proper concatenation
    const relativePath = s.startsWith('/') ? s : `/${s}`;
    return `${API_BASE_URL}${relativePath}`;
  };

  // Validate profilePic - must be a non-empty string that's not just whitespace
  const isValidProfilePic = profilePic && 
    typeof profilePic === 'string' && 
    profilePic.trim() !== '' && 
    !profilePic.includes('null') && 
    !profilePic.includes('undefined') &&
    profilePic !== 'None' &&
    profilePic !== 'null' &&
    profilePic !== 'undefined';

  const uri = isValidProfilePic ? buildUri(profilePic) : null;

  // Only show profile picture if we have a valid, non-empty URI
  // Empty strings, null, undefined, or invalid URLs should show CTU logo
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    // Reset error state when profilePic changes
    setImageError(false);
  }, [profilePic]);

  if (!imageError && uri && uri.trim() !== '' && !uri.includes('null') && !uri.includes('undefined') && uri !== `${API_BASE_URL}null` && uri !== `${API_BASE_URL}undefined`) {
    return (
      <View style={[avatarStyle, style, styles.imageContainer]}>
        <CachedImage
          uri={uri}
          style={[avatarStyle, { position: 'absolute' }]}
          contentFit="cover"
          onError={() => {
            // If image fails to load, set error state to show CTU logo
            console.log('[UserAvatar] Image load failed for URI:', uri, 'will show CTU logo');
            setImageError(true);
          }}
        />
      </View>
    );
  }

  // Fallback to CTU logo when no profile picture or invalid URI
  return (
    <View style={[avatarStyle, style, styles.fallback]}>
      <Image
        source={require('../assets/images/ctu_logo.png')}
        style={avatarStyle}
        resizeMode="cover"
      />
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
    overflow: 'hidden',
  },
});

export default UserAvatar;

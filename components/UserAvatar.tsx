import React from 'react';
import CachedImage from './CachedImage';

interface UserAvatarProps {
  profilePic?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  style?: any;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  size = 40,
  style 
}) => {
  const safeSize = Math.max(1, Math.abs(size || 40));

  const avatarStyle = {
    width: safeSize,
    height: safeSize,
    borderRadius: safeSize / 2,
  } as const;

  return (
    <CachedImage
      uri={null}
      style={[avatarStyle, style]}
      contentFit="cover"
    />
  );
};

 

export default UserAvatar;

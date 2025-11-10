import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface PasswordVisibilityIconProps {
  show: boolean;
  size?: number;
  color?: string;
}

/**
 * Password visibility icon component for React Native
 * Shows an open eye when password is visible, or an eye with diagonal line when hidden
 * Uses Ionicons for standard design
 */
const PasswordVisibilityIcon: React.FC<PasswordVisibilityIconProps> = ({ 
  show, 
  size = 24, 
  color = '#000000' 
}) => {
  return show ? (
    <Ionicons name="eye" size={size} color={color} />
  ) : (
    <Ionicons name="eye-off" size={size} color={color} />
  );
};

export default PasswordVisibilityIcon;

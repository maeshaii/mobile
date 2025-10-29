import React from 'react';
import Svg, { Ellipse, Circle, Line } from 'react-native-svg';

interface PasswordVisibilityIconProps {
  show: boolean;
  size?: number;
  color?: string;
}

/**
 * Password visibility icon component for React Native
 * Shows an open eye when password is visible, or an eye with diagonal line when hidden
 */
const PasswordVisibilityIcon: React.FC<PasswordVisibilityIconProps> = ({ 
  show, 
  size = 24, 
  color = '#000000' 
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Almond-shaped eye outline */}
      <Ellipse
        cx="12"
        cy="12"
        rx="11"
        ry="7"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pupil (circular) */}
      <Circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
      {/* Diagonal line through the eye when password is hidden */}
      {!show && (
        <Line
          x1="1"
          y1="1"
          x2="23"
          y2="23"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
};

export default PasswordVisibilityIcon;

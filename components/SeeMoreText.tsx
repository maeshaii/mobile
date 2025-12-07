import React, { useState } from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';

interface SeeMoreTextProps {
  text: string;
  maxLength?: number;
  renderText?: (text: string) => React.ReactNode;
  style?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle | ViewStyle[];
  buttonBelow?: boolean; // If true, button appears below text instead of inline
}

const SeeMoreText: React.FC<SeeMoreTextProps> = ({
  text,
  maxLength = 500,
  renderText,
  style,
  containerStyle,
  buttonBelow = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text || text.length <= maxLength) {
    return (
      <View style={containerStyle}>
        {renderText ? renderText(text) : <Text style={style}>{text}</Text>}
      </View>
    );
  }

  const truncatedText = text.substring(0, maxLength);
  const displayText = isExpanded ? text : truncatedText;

  // Get font size from style prop for consistency
  const fontSize = Array.isArray(style) 
    ? (style.find(s => s?.fontSize)?.fontSize || 14)
    : (style?.fontSize || 14);

  // If buttonBelow is true, render button below the text
  if (buttonBelow) {
    return (
      <View style={containerStyle}>
        {renderText ? renderText(displayText) : <Text style={style}>{displayText}</Text>}
        <Text
          onPress={() => setIsExpanded(!isExpanded)}
          style={[styles.seeMoreButton, { fontSize, marginTop: 4 }]}
        >
          {isExpanded ? 'See less' : 'See more'}
        </Text>
      </View>
    );
  }

  // If renderText is provided, it might return complex React elements (Views, etc.)
  // So we need to use a View container. Otherwise, we can use nested Text for better inline flow.
  if (renderText) {
    return (
      <View style={containerStyle}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, flexShrink: 1 }}>
            {renderText(displayText)}
          </View>
          <Text>{' '}</Text>
          <Text
            onPress={() => setIsExpanded(!isExpanded)}
            style={[styles.seeMoreButton, { fontSize }]}
          >
            {isExpanded ? 'See less' : 'See more'}
          </Text>
        </View>
      </View>
    );
  }

  // For plain text, use nested Text for better inline flow
  return (
    <View style={containerStyle}>
      <Text style={style}>
        {displayText}
        {' '}
        <Text
          onPress={() => setIsExpanded(!isExpanded)}
          style={[styles.seeMoreButton, { fontSize }]}
        >
          {isExpanded ? 'See less' : 'See more'}
        </Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  seeMoreButton: {
    color: '#1da1f2',
    fontWeight: '600',
    textDecorationLine: 'none',
  },
});

export default SeeMoreText;


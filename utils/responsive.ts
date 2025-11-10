import { Dimensions, PixelRatio, Platform } from 'react-native';

// Get screen dimensions safely
const getInitialScreenDimensions = () => {
  try {
    const dims = Dimensions.get('window');
    return {
      width: dims?.width || 375,
      height: dims?.height || 812,
    };
  } catch (error) {
    // Fallback to default dimensions if Dimensions.get fails
    return {
      width: 375,
      height: 812,
    };
  }
};

const screenDims = getInitialScreenDimensions();
const SCREEN_WIDTH = screenDims.width;
const SCREEN_HEIGHT = screenDims.height;

// Base dimensions (iPhone 11 Pro - commonly used as base)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Scale factor based on screen width
const scale = SCREEN_WIDTH / BASE_WIDTH;
const verticalScale = SCREEN_HEIGHT / BASE_HEIGHT;

// Moderate scale for font sizes (less aggressive scaling)
const moderateScale = (size: number, factor: number = 0.5) => {
  return size + (scale - 1) * size * factor;
};

/**
 * Responsive width - scales based on screen width
 * @param size - Base size in points
 * @returns Scaled size
 */
export const wp = (size: number): number => {
  return (size / BASE_WIDTH) * SCREEN_WIDTH;
};

/**
 * Responsive height - scales based on screen height
 * @param size - Base size in points
 * @returns Scaled size
 */
export const hp = (size: number): number => {
  return (size / BASE_HEIGHT) * SCREEN_HEIGHT;
};

/**
 * Responsive font size - moderate scaling for better readability
 * @param size - Base font size
 * @param factor - Scaling factor (0-1), default 0.5
 * @returns Scaled font size
 */
export const rf = (size: number, factor: number = 0.5): number => {
  return moderateScale(size, factor);
};

/**
 * Get responsive pixel size
 * @param size - Base size
 * @returns Pixel-perfect size
 */
export const rp = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * scale);
};

/**
 * Get screen dimensions
 */
export const getScreenDimensions = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  scale,
  verticalScale,
});

/**
 * Check if device is tablet
 */
export const isTablet = (): boolean => {
  const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
  return (
    (Platform.OS === 'ios' && SCREEN_WIDTH >= 768) ||
    (Platform.OS === 'android' && SCREEN_WIDTH >= 600) ||
    (SCREEN_WIDTH >= 768 && aspectRatio < 1.6)
  );
};

/**
 * Check if device is small screen
 */
export const isSmallScreen = (): boolean => {
  return SCREEN_WIDTH < 375;
};

/**
 * Check if device is large screen
 */
export const isLargeScreen = (): boolean => {
  return SCREEN_WIDTH >= 414;
};

/**
 * Get responsive padding
 * @param base - Base padding value
 * @returns Responsive padding
 */
export const getResponsivePadding = (base: number = 16): number => {
  if (isTablet()) {
    return base * 1.5;
  }
  if (isSmallScreen()) {
    return base * 0.85;
  }
  return base;
};

/**
 * Get responsive margin
 * @param base - Base margin value
 * @returns Responsive margin
 */
export const getResponsiveMargin = (base: number = 16): number => {
  if (isTablet()) {
    return base * 1.5;
  }
  if (isSmallScreen()) {
    return base * 0.85;
  }
  return base;
};

/**
 * Get responsive font size based on screen size
 * @param base - Base font size
 * @returns Responsive font size
 */
export const getResponsiveFontSize = (base: number): number => {
  if (isTablet()) {
    return base * 1.2;
  }
  if (isSmallScreen()) {
    return base * 0.9;
  }
  return base;
};

/**
 * Get percentage width
 * @param percentage - Percentage of screen width (0-100)
 * @returns Width in pixels
 */
export const getPercentageWidth = (percentage: number): number => {
  return (SCREEN_WIDTH * percentage) / 100;
};

/**
 * Get percentage height
 * @param percentage - Percentage of screen height (0-100)
 * @returns Height in pixels
 */
export const getPercentageHeight = (percentage: number): number => {
  return (SCREEN_HEIGHT * percentage) / 100;
};

/**
 * Responsive border radius
 * @param base - Base border radius
 * @returns Responsive border radius
 */
export const getResponsiveBorderRadius = (base: number = 8): number => {
  if (isTablet()) {
    return base * 1.2;
  }
  return base;
};

// Export screen dimensions for direct use
export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;


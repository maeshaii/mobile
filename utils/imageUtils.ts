import { API_BASE_URL } from '../services/api';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface ContentImage {
  image_id: number;
  image_url: string;
  order: number;
}

/**
 * Convert image URI to base64 string with error handling
 * Uses a platform-specific approach to avoid FileSystem issues
 */
export const convertImageToBase64 = async (uri: string): Promise<string | null> => {
  console.log('Converting image to base64:', uri);
  
  // For now, return the URI directly as a workaround
  // The backend should handle the image URI directly
  console.log('Using URI directly instead of base64 conversion');
  return uri;
};

/**
 * Alternative method using fetch for base64 conversion (if needed)
 */
export const convertImageToBase64WithFetch = async (uri: string): Promise<string | null> => {
  try {
    console.log('Converting image to base64 using fetch:', uri);
    
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        console.log('Fetch base64 conversion successful, length:', result.length);
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Fetch base64 conversion failed:', error);
    return null;
  }
};

/**
 * Extract images from a post/donation/forum item
 * Handles both legacy single image and new ContentImage table format
 */
export const getImagesFromContent = (content: any): ContentImage[] => {
  const images: ContentImage[] = [];
  
  console.log('=== IMAGE UTILS DEBUG ===');
  console.log('Content object:', JSON.stringify(content, null, 2));
  console.log('Content post_image:', content.post_image);
  console.log('Content post_images:', content.post_images);
  console.log('Content images:', content.images);
  
  // Add main image if exists (backward compatibility)
  if (content.post_image) {
    console.log('Adding post_image:', content.post_image);
    images.push({
      image_id: 0,
      image_url: content.post_image,
      order: 0
    });
  }
  
  // Add images array if exists (ContentImage table format)
  if (content.post_images && Array.isArray(content.post_images)) {
    console.log('Adding post_images array:', content.post_images);
    images.push(...content.post_images);
  }
  
  // Add images from ContentImage table (new format)
  if (content.images && Array.isArray(content.images)) {
    console.log('Adding images array:', content.images);
    images.push(...content.images);
  }
  
  console.log('Final images array:', images);
  console.log('=== END IMAGE UTILS DEBUG ===');
  
  return images.sort((a, b) => a.order - b.order);
};

/**
 * Get the first image URL for display
 */
export const getFirstImageUrl = (content: any): string | null => {
  const images = getImagesFromContent(content);
  if (images.length === 0) return null;
  
  const imageUrl = images[0].image_url;
  console.log('getFirstImageUrl - imageUrl:', imageUrl);
  console.log('getFirstImageUrl - API_BASE_URL:', API_BASE_URL);
  
  // If the URL already starts with http, use it directly (backend provides full URLs)
  if (String(imageUrl).startsWith('http')) {
    console.log('getFirstImageUrl - using full URL from backend:', imageUrl);
    return imageUrl;
  }
  
  // Only prepend API_BASE_URL if it's a relative URL
  const finalUrl = `${API_BASE_URL}${imageUrl}`;
  console.log('getFirstImageUrl - constructed URL:', finalUrl);
  return finalUrl;
};

/**
 * Get all image URLs for gallery display
 */
export const getAllImageUrls = (content: any): string[] => {
  const images = getImagesFromContent(content);
  return images.map(img => {
    // If the URL already starts with http, use it directly (backend provides full URLs)
    if (String(img.image_url).startsWith('http')) {
      return img.image_url;
    }
    // Only prepend API_BASE_URL if it's a relative URL
    return `${API_BASE_URL}${img.image_url}`;
  });
};

/**
 * Check if content has images
 */
export const hasImages = (content: any): boolean => {
  return getImagesFromContent(content).length > 0;
};

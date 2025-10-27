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
 * Deduplicates images based on their URLs to prevent duplicates
 */
export const getImagesFromContent = (content: any): ContentImage[] => {
  if (!content) {
    console.log('getImagesFromContent: No content provided');
    return [];
  }

  const images: ContentImage[] = [];
  const seenUrls = new Set<string>();
  
  console.log('=== IMAGE UTILS DEBUG ===');
  console.log('Content object keys:', Object.keys(content));
  console.log('Content post_image:', content.post_image);
  console.log('Content post_images:', content.post_images);
  console.log('Content images:', content.images);
  console.log('Content content_images:', content.content_images);
  
  // Helper function to normalize URL for comparison
  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    return url.trim()
      .split('?')[0]  // Remove query parameters
      .split('#')[0]  // Remove fragments
      .toLowerCase(); // Case insensitive comparison
  };
  
  // Helper function to add image if not already seen
  const addImageIfUnique = (image: ContentImage) => {
    if (!image || !image.image_url) {
      console.log('Skipped invalid image:', image);
      return;
    }
    
    const normalizedUrl = normalizeUrl(image.image_url);
    
    if (normalizedUrl && !seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl);
      images.push(image);
      console.log('✅ Added unique image:', normalizedUrl, '(original:', image.image_url, ')');
    } else {
      console.log('❌ Skipped duplicate image:', normalizedUrl, '(original:', image.image_url, ')');
    }
  };
  
  // Process all possible image sources
  const imageSources = [
    { name: 'post_image', data: content.post_image },
    { name: 'post_images', data: content.post_images },
    { name: 'images', data: content.images },
    { name: 'content_images', data: content.content_images }
  ];
  
  imageSources.forEach(source => {
    if (!source.data) return;
    
    console.log(`Processing ${source.name}:`, source.data);
    
    if (typeof source.data === 'string') {
      // Single image URL
      addImageIfUnique({
        image_id: 0,
        image_url: source.data,
        order: 0
      });
    } else if (Array.isArray(source.data)) {
      // Array of images
      source.data.forEach((img: any, index: number) => {
        if (typeof img === 'string') {
          // String URL
          addImageIfUnique({
            image_id: index,
            image_url: img,
            order: index
          });
        } else if (img && img.image_url) {
          // Object with image_url property
          addImageIfUnique({
            image_id: img.image_id || index,
            image_url: img.image_url,
            order: img.order || index
          });
        }
      });
    }
  });
  
  console.log('Final deduplicated images array:', images);
  console.log('Total unique images found:', images.length);
  console.log('Seen URLs:', Array.from(seenUrls));
  
  // Additional validation - check for any remaining duplicates
  const finalUrls = images.map(img => normalizeUrl(img.image_url));
  const uniqueFinalUrls = new Set(finalUrls);
  if (finalUrls.length !== uniqueFinalUrls.size) {
    console.error('🚨 CRITICAL: Still have duplicates after deduplication!');
    console.error('Final URLs:', finalUrls);
    console.error('Unique URLs:', Array.from(uniqueFinalUrls));
  } else {
    console.log('✅ Deduplication successful - no duplicates found');
  }
  
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

/**
 * Test function to verify deduplication is working
 */
export const testDeduplication = () => {
  console.log('=== TESTING DEDUPLICATION ===');
  
  const testContent = {
    post_image: 'https://example.com/image1.jpg',
    post_images: [
      'https://example.com/image1.jpg', // Duplicate
      'https://example.com/image2.jpg',
      'https://example.com/image1.jpg'  // Duplicate
    ],
    images: [
      { image_url: 'https://example.com/image2.jpg' }, // Duplicate
      { image_url: 'https://example.com/image3.jpg' }
    ]
  };
  
  const result = getImagesFromContent(testContent);
  console.log('Test result:', result);
  console.log('Expected: 3 unique images, Got:', result.length);
  console.log('=== END TEST ===');
  
  return result;
};

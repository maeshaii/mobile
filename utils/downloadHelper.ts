import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

/**
 * Download file and save to device using expo-sharing
 * Compatible with Expo Go (no custom native permissions needed)
 */
export async function downloadFileToDevice(
  url: string,
  filename: string,
  fileType: 'image' | 'video' | 'document',
  mimeType?: string
): Promise<boolean> {
  try {
    console.log('📥 Starting download:', { url, filename, fileType });

    // Step 1: Download file to cache
    const downloadDest = FileSystem.cacheDirectory + filename;
    console.log('⬇️ Downloading to cache:', downloadDest);

    const downloadResult = await FileSystem.downloadAsync(url, downloadDest, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'MobileApp/1.0',
      },
    });

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    console.log('✅ File downloaded to cache:', downloadResult.uri);

    // Step 2: Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        'Not Supported',
        'Sharing is not available on this device.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // Step 3: Use Android's native share sheet to save file
    // This allows user to choose where to save (Gallery, Downloads, Drive, etc.)
    await Sharing.shareAsync(downloadResult.uri, {
      mimeType: mimeType || 'application/octet-stream',
      dialogTitle: `Save ${fileType}`,
      UTI: mimeType || 'public.item',
    });

    console.log('✅ Share dialog shown for:', filename);

    // Show success message
    Alert.alert(
      'Download Ready',
      `${filename}\n\nUse the share menu to save to your device.`,
      [{ text: 'OK' }]
    );

    return true;
  } catch (error) {
    console.error('❌ Download error:', error);
    Alert.alert(
      'Download Failed',
      'Could not download file. Please try again.',
      [{ text: 'OK' }]
    );
    return false;
  }
}

/**
 * Download image to device
 */
export async function downloadImage(url: string, filename?: string, mimeType: string = 'image/jpeg'): Promise<boolean> {
  const finalFilename = filename || `image_${Date.now()}.jpg`;
  return downloadFileToDevice(url, finalFilename, 'image', mimeType);
}

/**
 * Download video to device
 */
export async function downloadVideo(url: string, filename?: string, mimeType: string = 'video/mp4'): Promise<boolean> {
  const finalFilename = filename || `video_${Date.now()}.mp4`;
  return downloadFileToDevice(url, finalFilename, 'video', mimeType);
}

/**
 * Download document/PDF to device
 */
export async function downloadDocument(url: string, filename: string, mimeType: string = 'application/octet-stream'): Promise<boolean> {
  return downloadFileToDevice(url, filename, 'document', mimeType);
}

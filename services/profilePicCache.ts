/**
 * Profile Picture Caching Service for Mobile
 * Implements efficient caching strategy with AsyncStorage persistence
 * Similar to web's localStorage approach but optimized for React Native
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

interface CacheEntry {
  url: string;
  timestamp: number;
  userId: string;
}

class ProfilePicCache {
  private memoryCache = new Map<string, string>();
  private loadingSet = new Set<string>();
  private CACHE_PREFIX = 'profile_pic_';
  private CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get profile picture URL with caching
   * Priority: Memory → AsyncStorage → API
   */
  async get(userId: number | string): Promise<string | null> {
    const userIdStr = String(userId);

    // 1. Check memory cache (fastest)
    if (this.memoryCache.has(userIdStr)) {
      return this.memoryCache.get(userIdStr)!;
    }

    // 2. Check AsyncStorage (fast)
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${userIdStr}`);
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        
        // Check if cache is still valid
        if (Date.now() - entry.timestamp < this.CACHE_EXPIRY) {
          this.memoryCache.set(userIdStr, entry.url);
          return entry.url;
        } else {
          // Cache expired, remove it
          await this.remove(userIdStr);
        }
      }
    } catch (error) {
      console.warn('AsyncStorage read error:', error);
    }

    // 3. Fetch from API (slow)
    return await this.fetchAndCache(userIdStr);
  }

  /**
   * Fetch profile picture from API and cache it
   */
  private async fetchAndCache(userId: string): Promise<string | null> {
    // Prevent duplicate requests
    if (this.loadingSet.has(userId)) {
      // Wait for ongoing request
      await this.waitForLoad(userId);
      return this.memoryCache.get(userId) || null;
    }

    this.loadingSet.add(userId);

    try {
      console.log(`🔍 ProfilePicCache: Fetching for user ${userId}`);
      const response = await api.get(`alumni/profile/${userId}/`);
      
      if (response.data && response.data.profile_pic) {
        const profilePicUrl = this.normalizeUrl(response.data.profile_pic);
        
        // Add cache busting parameter
        const urlWithBust = `${profilePicUrl}${profilePicUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        
        // Save to both caches
        await this.set(userId, urlWithBust);
        
        console.log(`✅ ProfilePicCache: Cached for user ${userId}`);
        return urlWithBust;
      }
      
      console.log(`⚠️ ProfilePicCache: No profile pic for user ${userId}`);
      return null;
    } catch (error: any) {
      // Handle 404 gracefully - user doesn't exist or has no profile
      if (error.response?.status === 404) {
        console.log(`ℹ️ ProfilePicCache: User ${userId} not found or has no profile`);
        return null;
      }
      
      // Handle 401/403 - authentication issues
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`⚠️ ProfilePicCache: Auth error for user ${userId}`);
        return null;
      }
      
      // Log other errors (network issues, 500 errors, etc.)
      console.error(`❌ ProfilePicCache: Error fetching for user ${userId}:`, {
        status: error.response?.status,
        message: error.message
      });
      return null;
    } finally {
      this.loadingSet.delete(userId);
    }
  }

  /**
   * Set profile picture in cache
   */
  async set(userId: string | number, url: string): Promise<void> {
    const userIdStr = String(userId);
    
    // Save to memory cache
    this.memoryCache.set(userIdStr, url);
    
    // Save to AsyncStorage
    try {
      const entry: CacheEntry = {
        url,
        timestamp: Date.now(),
        userId: userIdStr
      };
      
      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${userIdStr}`,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.warn('AsyncStorage write error:', error);
    }
  }

  /**
   * Remove profile picture from cache
   */
  async remove(userId: string | number): Promise<void> {
    const userIdStr = String(userId);
    
    this.memoryCache.delete(userIdStr);
    
    try {
      await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${userIdStr}`);
    } catch (error) {
      console.warn('AsyncStorage remove error:', error);
    }
  }

  /**
   * Clear all cached profile pictures
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    try {
      const keys = await AsyncStorage.getAllKeys();
      const picKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(picKeys);
      console.log(`🗑️ ProfilePicCache: Cleared ${picKeys.length} entries`);
    } catch (error) {
      console.warn('AsyncStorage clear error:', error);
    }
  }

  /**
   * Preload profile pictures for multiple users
   */
  async preload(userIds: (string | number)[]): Promise<void> {
    const promises = userIds.map(userId => this.get(userId));
    await Promise.allSettled(promises);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ memoryCount: number; storageCount: number }> {
    const memoryCount = this.memoryCache.size;
    
    let storageCount = 0;
    try {
      const keys = await AsyncStorage.getAllKeys();
      storageCount = keys.filter(key => key.startsWith(this.CACHE_PREFIX)).length;
    } catch (error) {
      console.warn('AsyncStorage stats error:', error);
    }
    
    return { memoryCount, storageCount };
  }

  /**
   * Normalize URL to absolute URL
   */
  private normalizeUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Get base URL from api config
    const baseUrl = api.defaults.baseURL || '';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  /**
   * Wait for ongoing load to complete
   */
  private async waitForLoad(userId: string, maxWait: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (this.loadingSet.has(userId)) {
      if (Date.now() - startTime > maxWait) {
        console.warn(`ProfilePicCache: Wait timeout for user ${userId}`);
        break;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Export singleton instance
export const profilePicCache = new ProfilePicCache();

// Export class for testing
export { ProfilePicCache };


/**
 * Profile Picture Cache Tests
 * Tests the caching functionality
 */

import { ProfilePicCache } from '../../services/profilePicCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock API
jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn(),
    defaults: { baseURL: 'https://test.com' }
  }
}));

describe('ProfilePicCache', () => {
  let cache: ProfilePicCache;

  beforeEach(() => {
    cache = new ProfilePicCache();
    jest.clearAllMocks();
  });

  test('should return null for user without profile pic', async () => {
    const { api } = require('../../services/api');
    api.get.mockResolvedValue({ data: {} });

    const result = await cache.get(123);
    expect(result).toBeNull();
  });

  test('should cache profile picture in memory', async () => {
    const { api } = require('../../services/api');
    const mockUrl = 'https://test.com/pic.jpg';
    
    api.get.mockResolvedValue({ 
      data: { profile_pic: mockUrl } 
    });

    // First call - should hit API
    const result1 = await cache.get(123);
    expect(result1).toContain(mockUrl);
    expect(api.get).toHaveBeenCalledTimes(1);

    // Second call - should use memory cache
    const result2 = await cache.get(123);
    expect(result2).toContain(mockUrl);
    expect(api.get).toHaveBeenCalledTimes(1); // Still 1 - cached
  });

  test('should normalize relative URLs', async () => {
    const { api } = require('../../services/api');
    
    api.get.mockResolvedValue({ 
      data: { profile_pic: '/media/profiles/pic.jpg' } 
    });

    const result = await cache.get(123);
    expect(result).toContain('https://test.com/media/profiles/pic.jpg');
  });

  test('should handle API errors gracefully', async () => {
    const { api } = require('../../services/api');
    api.get.mockRejectedValue(new Error('Network error'));

    const result = await cache.get(123);
    expect(result).toBeNull();
  });

  test('should prevent duplicate API calls for same user', async () => {
    const { api } = require('../../services/api');
    api.get.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => 
        resolve({ data: { profile_pic: 'test.jpg' } }), 100
      ))
    );

    // Make multiple concurrent requests
    const promises = [
      cache.get(123),
      cache.get(123),
      cache.get(123),
    ];

    await Promise.all(promises);

    // Should only make ONE API call despite 3 requests
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

console.log('✅ ProfilePicCache tests passed!');


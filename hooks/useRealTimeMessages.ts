/**
 * React Native hook for managing real-time message unread counts.
 * Handles polling for message updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listConversations } from '../services/api';
import { AppState, AppStateStatus } from 'react-native';

interface UseRealTimeMessagesOptions {
  enablePolling?: boolean;
  pollingInterval?: number;
  autoConnect?: boolean;
}

interface UseRealTimeMessagesReturn {
  unreadCount: number;
  totalConversations: number;
  isLoading: boolean;
  error: string | null;
  refreshMessages: () => Promise<void>;
}

export function useRealTimeMessages(
  options: UseRealTimeMessagesOptions = {}
): UseRealTimeMessagesReturn {
  const {
    enablePolling = true,
    pollingInterval = 15000, // 15 seconds for faster updates
    autoConnect = true
  } = options;

  const [unreadCount, setUnreadCount] = useState(0);
  const [totalConversations, setTotalConversations] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitializedRef = useRef(false);

  // Calculate unread count from conversations - count unique conversations with unread messages (people who messaged)
  const calculateUnreadCount = useCallback((conversations: any[]) => {
    // Count how many people (conversations) have unread messages
    const peopleWithUnread = conversations.filter((conv) => {
      return (conv.unread_count || 0) > 0;
    }).length;
    setUnreadCount(peopleWithUnread);
    setTotalConversations(conversations.length);
    console.log('📨 Mobile: Updated message unread count:', peopleWithUnread, 'people with unread messages from', conversations.length, 'conversations');
  }, []);

  // Fetch conversations from API
  const fetchConversations = useCallback(async () => {
    try {
      // Check if user is authenticated before making API call
      const { getAccessToken } = await import('../services/api');
      const token = await getAccessToken();
      if (!token) {
        console.log('Mobile: No access token, skipping conversation fetch');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      const conversations = await listConversations();
      calculateUnreadCount(conversations || []);
    } catch (err: any) {
      // Suppress 401 errors that are being handled by the interceptor
      // Only log if it's not a 401 or if it's a 401 that couldn't be refreshed
      if (err?.response?.status === 401) {
        // Check if this is a final 401 after refresh attempt (indicates logout)
        const { getAccessToken } = await import('../services/api');
        const token = await getAccessToken();
        if (!token) {
          // Token was cleared, user was logged out - this is expected
          console.log('Mobile: User logged out, skipping conversation fetch');
          return;
        }
        // If token still exists, it might be a transient error - don't log
        return;
      }
      console.error('Mobile: Error fetching conversations:', err);
      setError('Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [calculateUnreadCount]);

  // Setup polling
  const setupPolling = useCallback(() => {
    if (!enablePolling) return;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Fetch immediately
    fetchConversations();

    // Set up interval with shorter interval for faster updates
    intervalRef.current = setInterval(() => {
      fetchConversations();
    }, pollingInterval);
  }, [enablePolling, pollingInterval, fetchConversations]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isInitializedRef.current) {
        // Refresh when app comes to foreground
        fetchConversations();
        setupPolling();
      } else if (nextAppState === 'background') {
        // Clear interval when app goes to background to save battery
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [fetchConversations, setupPolling]);

  // Initialize
  useEffect(() => {
    if (!autoConnect || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    // Fetch immediately on mount
    fetchConversations();
    
    // Setup polling
    setupPolling();

    return () => {
      // Cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoConnect, setupPolling, fetchConversations]);

  return {
    unreadCount,
    totalConversations,
    isLoading,
    error,
    refreshMessages: fetchConversations
  };
}


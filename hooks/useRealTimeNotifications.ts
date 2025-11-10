/**
 * React Native hook for managing real-time notifications.
 * Handles WebSocket connection, notification updates, and polling fallback.
 * Matches web frontend implementation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NotificationWebSocket, NotificationWsEvent } from '../services/notificationWebSocket';
import { getNotifications, getUserInfo, getAccessToken, API_BASE_URL } from '../services/api';

interface UseRealTimeNotificationsOptions {
  enablePolling?: boolean;
  pollingInterval?: number;
  autoConnect?: boolean;
}

interface NotificationUpdate {
  id: number;
  type: string;
  subject: string;
  content: string;
  date: string;
  is_read: boolean;
  [key: string]: any; // Allow additional properties
}

interface UseRealTimeNotificationsReturn {
  notifications: NotificationUpdate[];
  notificationCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  refreshCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useRealTimeNotifications(
  options: UseRealTimeNotificationsOptions = {}
): UseRealTimeNotificationsReturn {
  const {
    enablePolling = true,
    pollingInterval = 30000, // 30 seconds - matches web
    autoConnect = true
  } = options;

  const [notifications, setNotifications] = useState<NotificationUpdate[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<NotificationWebSocket | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitializedRef = useRef(false);
  const currentUserIdRef = useRef<number | null>(null);

  // Get current user ID
  const getCurrentUserId = useCallback(async () => {
    if (currentUserIdRef.current) return currentUserIdRef.current;
    
    try {
      const user = await getUserInfo();
      const userId = user?.user_id || user?.id;
      currentUserIdRef.current = userId || null;
      return userId;
    } catch (err) {
      console.error('Error getting user ID:', err);
      return null;
    }
  }, []);

  // Fetch notifications from API
  const fetchNotificationsData = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.warn('No user ID available for fetching notifications');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      const data = await getNotifications(userId);
      
      if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        
        // Update count based on unread notifications
        const unreadCount = data.notifications.filter((n: any) => !n.is_read && !n.read).length;
        setNotificationCount(unreadCount);
        console.log('📊 Mobile: Fetched notifications, unread count:', unreadCount);
      } else {
        setNotifications([]);
        setNotificationCount(0);
      }
    } catch (err) {
      console.error('Mobile: Error fetching notifications:', err);
      setError('Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentUserId]);

  // Fetch notification count (lightweight)
  const fetchCountData = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      // For now, we'll use the full fetch and just count
      // Backend can optimize this with a dedicated count endpoint later
      const data = await getNotifications(userId);
      if (data && Array.isArray(data.notifications)) {
        const unreadCount = data.notifications.filter((n: any) => !n.is_read && !n.read).length;
        setNotificationCount(unreadCount);
        console.log('📊 Mobile: Updated notification count:', unreadCount);
      }
    } catch (err) {
      console.error('Mobile: Error fetching notification count:', err);
    }
  }, [getCurrentUserId]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      // Update local state immediately for better UX
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read: true } : n)
      );
      
      // Update count
      setNotificationCount(prev => {
        const newCount = Math.max(0, prev - 1);
        console.log('📊 Mobile: Marked as read, updated count:', newCount);
        return newCount;
      });
      
      // Call API to mark as read
      try {
        const { markNotificationAsRead } = await import('../services/api');
        await markNotificationAsRead(notificationId);
        console.log('✅ Mobile: Successfully marked notification as read on backend');
      } catch (apiError) {
        console.error('Mobile: API error marking notification as read:', apiError);
        // Don't revert local state - better to show as read even if API fails
      }
      
    } catch (err) {
      console.error('Mobile: Error marking notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read: true })));
      setNotificationCount(0);
      console.log('📊 Mobile: Marked all as read');
      
      // Call API to mark all as read
      try {
        const userId = await getCurrentUserId();
        if (userId) {
          const { markAllNotificationsAsRead } = await import('../services/api');
          await markAllNotificationsAsRead(userId);
          console.log('✅ Mobile: Successfully marked all notifications as read on backend');
        }
      } catch (apiError) {
        console.error('Mobile: API error marking all notifications as read:', apiError);
        // Don't revert local state - better to show as read even if API fails
      }
      
    } catch (err) {
      console.error('Mobile: Error marking all notifications as read:', err);
    }
  }, [getCurrentUserId]);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    await fetchNotificationsData();
  }, [fetchNotificationsData]);

  // Refresh count
  const refreshCount = useCallback(async () => {
    await fetchCountData();
  }, [fetchCountData]);

  // Setup WebSocket connection
  const setupWebSocket = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      const token = await getAccessToken();
      
      if (!userId) {
        console.warn('⚠️ Mobile: No user ID for WebSocket connection');
        return;
      }

      if (!token) {
        console.warn('⚠️ Mobile: No access token found! WebSocket will not connect.');
        return;
      }
      
      console.log('🔌 Mobile: Setting up notification WebSocket...');
      
      // Create WebSocket instance
      const ws = new NotificationWebSocket(userId, API_BASE_URL, token);
      wsRef.current = ws;

      // Handle connection status
      ws.onStatus((status) => {
        console.log('📡 Mobile: WebSocket status:', status);
        setIsConnected(status === 'connected');
        if (status === 'error') {
          // Suppress error - gracefully degrade to polling
          console.log('ℹ️ Mobile: Using polling fallback (WebSocket unavailable)');
        }
      });

      // Handle notification events
      ws.onNotification((event: NotificationWsEvent) => {
        console.log('📬 Mobile: Notification event received:', event.type);
        
        switch (event.type) {
          case 'notification':
            // Add new notification to the list
            const newNotification: NotificationUpdate = {
              id: event.notification_id,
              type: event.notification_type,
              subject: 'Notification',
              content: event.message,
              date: event.created_at,
              is_read: event.is_read,
              read: event.is_read,
            };
            
            setNotifications(prev => {
              const currentNotifications = Array.isArray(prev) ? prev : [];
              // Check if notification already exists
              const existingIndex = currentNotifications.findIndex(n => n.id === newNotification.id);
              if (existingIndex >= 0) {
                // Update existing notification
                const updated = [...currentNotifications];
                updated[existingIndex] = newNotification;
                return updated;
              } else {
                // Add new notification at the beginning
                return [newNotification, ...currentNotifications];
              }
            });
            
            // Update count if unread
            if (!event.is_read) {
              setNotificationCount(prev => {
                const newCount = prev + 1;
                console.log('📊 Mobile: New unread notification, count:', newCount);
                return newCount;
              });
            }
            break;

          case 'notification_count':
            setNotificationCount(event.count);
            console.log('📊 Mobile: Notification count update:', event.count);
            break;

          case 'connection_established':
            console.log('✅ Mobile: Notification WebSocket connected for user:', event.user_id);
            setError(null);
            break;

          case 'error':
            console.warn('⚠️ Mobile: WebSocket error:', event.message);
            setIsConnected(false);
            break;
        }
      });

      // Connect WebSocket (non-blocking)
      console.log('🚀 Mobile: Attempting to connect WebSocket...');
      ws.connect().catch((err) => {
        // Suppress error - gracefully degrade to polling
        console.log('ℹ️ Mobile: WebSocket unavailable, using polling fallback');
        setIsConnected(false);
      });

    } catch (err) {
      // Suppress error - gracefully degrade to polling
      console.log('ℹ️ Mobile: WebSocket unavailable, using polling fallback');
      setIsConnected(false);
    }
  }, [getCurrentUserId]);

  // Setup polling fallback
  const setupPolling = useCallback(() => {
    if (!enablePolling) return;

    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Setup new interval
    pollingIntervalRef.current = setInterval(async () => {
      // Always poll to ensure data stays updated
      await Promise.all([fetchNotificationsData(), fetchCountData()]);
    }, pollingInterval);

    console.log('🔄 Mobile: Polling enabled, interval:', pollingInterval, 'ms');
  }, [enablePolling, pollingInterval, fetchNotificationsData, fetchCountData]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('📱 Mobile: App state changed to:', nextAppState);
      
      if (nextAppState === 'active' && isInitializedRef.current) {
        // Refresh when app comes to foreground
        console.log('🔄 Mobile: App became active, refreshing notifications...');
        Promise.all([fetchNotificationsData(), fetchCountData()]);
        setupPolling();
        
        // Reconnect WebSocket if needed
        if (autoConnect && !isConnected) {
          setupWebSocket();
        }
      } else if (nextAppState === 'background') {
        // Clear interval when app goes to background to save battery
        console.log('💤 Mobile: App in background, pausing polling...');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [fetchNotificationsData, fetchCountData, setupPolling, setupWebSocket, autoConnect, isConnected]);

  // Initialize on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      console.log('🚀 Mobile: Initializing real-time notifications...');
      
      // Initial data fetch
      await Promise.all([fetchNotificationsData(), fetchCountData()]);

      // Setup WebSocket if auto-connect is enabled
      if (autoConnect) {
        console.log('🔌 Mobile: Auto-connect enabled, setting up WebSocket...');
        await setupWebSocket();
      } else {
        console.log('⚠️ Mobile: Auto-connect disabled');
      }

      // Setup polling fallback
      setupPolling();
    };

    initialize();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Mobile: Cleaning up real-time notifications...');
      
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []); // Only run once on mount

  return {
    notifications,
    notificationCount,
    isConnected,
    isLoading,
    error,
    refreshNotifications,
    refreshCount,
    markAsRead,
    markAllAsRead
  };
}


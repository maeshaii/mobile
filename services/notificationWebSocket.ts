import { getAccessToken } from './api';

export type NotificationWsEvent = 
  | { type: 'notification'; notification_id: number; message: string; notification_type: string; created_at: string; is_read: boolean; user_id: number }
  | { type: 'notification_count'; count: number; user_id: number }
  | { type: 'points_update'; points: { user_id: number; total_points: number; rank: number | null; points_breakdown: any } }
  | { type: 'connection_established'; user_id: number; timestamp: string }
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; message: string };

export type NotificationWsSendMessage = 
  | { type: 'ping' }
  | { type: 'mark_read'; notification_id: number };

export class NotificationWebSocket {
  private ws: WebSocket | null = null;
  private userId: number;
  private baseUrl: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;
  private isDestroyed = false;
  private messageQueue: NotificationWsSendMessage[] = [];
  private onNotificationCallback: ((event: NotificationWsEvent) => void) | null = null;
  private onStatusCallback: ((status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) | null = null;

  constructor(userId: number, baseUrl: string, token?: string) {
    this.userId = userId;
    this.baseUrl = baseUrl;
    this.token = token || null;
    console.log('NotificationWebSocket constructor - userId:', userId, 'token received:', !!this.token);
  }

  onNotification(callback: (event: NotificationWsEvent) => void) {
    this.onNotificationCallback = callback;
  }

  onStatus(callback: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) {
    this.onStatusCallback = callback;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.isDestroyed) return;
    
    this.isConnecting = true;
    this.onStatusCallback?.('connecting');

    try {
      // Get fresh token if not available
      if (!this.token) {
        this.token = await getAccessToken();
        console.log('NotificationWebSocket: Retrieved fresh token');
      }

      // Clean the base URL to prevent double slashes
      const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
      // Backend routing is /ws/notifications/ (without user ID in path)
      let wsUrl = `${cleanBaseUrl}/ws/notifications/`;
      
      // Add JWT token to URL if available
      if (this.token) {
        wsUrl += `?token=${encodeURIComponent(this.token)}`;
        console.log('NotificationWebSocket: Token added to URL');
      } else {
        console.log('NotificationWebSocket: No token available');
      }
      
      console.log('NotificationWebSocket: Connecting to:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.onStatusCallback?.('connected');
        this.startHeartbeat();
        this.flushMessageQueue();
        console.log('NotificationWebSocket: Connected successfully');
      };

      this.ws.onmessage = (event) => {
        try {
          const data: NotificationWsEvent = JSON.parse(event.data);
          console.log('NotificationWebSocket: Message received:', data.type);
          this.onNotificationCallback?.(data);
        } catch (error) {
          console.warn('NotificationWebSocket: Failed to parse message:', error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.onStatusCallback?.('disconnected');
        console.log('NotificationWebSocket: Connection closed:', event.code, event.reason);
        
        if (!this.isDestroyed && !event.wasClean) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.onStatusCallback?.('error');
        console.error('NotificationWebSocket: Connection error:', error);
      };

    } catch (error) {
      this.isConnecting = false;
      this.onStatusCallback?.('error');
      console.error('NotificationWebSocket: Connection failed:', error);
      throw error;
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('NotificationWebSocket: Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`NotificationWebSocket: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect().catch(error => {
          console.error('NotificationWebSocket: Reconnection failed:', error);
        });
      }
    }, delay);
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  send(message: NotificationWsSendMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
      console.log('NotificationWebSocket: Message queued, connection not ready');
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.messageQueue = [];
    console.log('NotificationWebSocket: Disconnected');
  }

  getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (this.isConnecting) return 'connecting';
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    if (this.ws?.readyState === WebSocket.CLOSED) return 'disconnected';
    return 'error';
  }
}

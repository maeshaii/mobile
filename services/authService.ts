import { loginUser, getAccessToken, getRefreshToken, logoutUser } from './api';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Platform-specific storage utility
const isWeb = Platform.OS === 'web';

const Storage = {
  setItem: async (key: string, value: string) => {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string) => {
    if (isWeb) {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  deleteItem: async (key: string) => {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

/**
 * 🔒 SECURITY: Decode JWT token to extract payload
 * Returns null if token is invalid or malformed
 */
function decodeJwt(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[AuthService] JWT decode error:', error);
    return null;
  }
}

/**
 * 🔒 SECURITY: Check if JWT token has expired
 * Returns true if token is expired or invalid
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true; // Treat invalid tokens as expired
  }
  
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds;
}

export interface AuthCredentials {
  acc_username: string;
  acc_password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: any;
  access?: string;
  refresh?: string;
  message?: string;
}

export interface UserSession {
  user: any;
  accessToken: string;
  refreshToken: string;
  lastLogin: Date;
}

class AuthService {
  private static instance: AuthService;
  private currentSession: UserSession | null = null;

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      const response = await loginUser(credentials.acc_username, credentials.acc_password);
      if (response.success && response.user && response.access && response.refresh) {
        await this.storeSession({
          user: response.user,
          accessToken: response.access,
          refreshToken: response.refresh,
          lastLogin: new Date()
        });
        return response;
      }
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: this.getErrorMessage(error)
      };
    }
  }

  private async storeSession(session: UserSession): Promise<void> {
    await Storage.setItem('accessToken', session.accessToken);
    await Storage.setItem('refreshToken', session.refreshToken);
    await Storage.setItem('user', JSON.stringify(session.user));
    await Storage.setItem('lastLogin', session.lastLogin.toISOString());
    this.currentSession = session;
  }

  async getCurrentSession(): Promise<UserSession | null> {
    if (this.currentSession) return this.currentSession;
    const accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();
    const userStr = await Storage.getItem('user');
    const lastLoginStr = await Storage.getItem('lastLogin');
    if (accessToken && refreshToken && userStr && lastLoginStr) {
      this.currentSession = {
        user: JSON.parse(userStr),
        accessToken,
        refreshToken,
        lastLogin: new Date(lastLoginStr)
      };
      return this.currentSession;
    }
    return null;
  }

  async isAuthenticated(): Promise<boolean> {
    // 🔒 SECURITY: Step 1 - Check if session exists
    const session = await this.getCurrentSession();
    if (!session) {
      console.log('[AuthService] No session found');
      return false;
    }

    // 🔒 SECURITY: Step 2 - Validate access token exists
    if (!session.accessToken || session.accessToken.trim() === '') {
      console.warn('[AuthService] Access token missing or empty');
      await this.logout();
      return false;
    }

    // 🔒 SECURITY: Step 3 - Validate JWT token expiration
    if (isTokenExpired(session.accessToken)) {
      console.warn('[AuthService] Access token expired');
      await this.logout();
      return false;
    }

    // 🔒 SECURITY: Step 4 - Check session age (fallback for tokens without exp)
    const now = new Date();
    const tokenAge = now.getTime() - session.lastLogin.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (tokenAge > maxAge) {
      console.warn('[AuthService] Session age exceeded 24 hours');
      await this.logout();
      return false;
    }

    return true;
  }

  async logout(): Promise<void> {
    await logoutUser();
    await Storage.deleteItem('accessToken');
    await Storage.deleteItem('refreshToken');
    await Storage.deleteItem('user');
    await Storage.deleteItem('lastLogin');
    this.currentSession = null;
  }

  async getUserInfo(): Promise<any> {
    const userStr = await Storage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Invalidate the current session cache and force rebuild from storage
   * This is useful after login when tokens are saved directly to storage
   */
  async invalidateSessionCache(): Promise<void> {
    this.currentSession = null;
    // Force rebuild from storage
    await this.getCurrentSession();
  }

  private getErrorMessage(error: any): string {
    if (error.response?.status === 401) {
      return 'Invalid credentials';
    } else if (error.response?.status === 400) {
      return 'Invalid input format';
    } else if (error.response?.status === 500) {
      return 'Server error. Please try again later.';
    } else if (error.code === 'NETWORK_ERROR') {
      return 'Network error. Please check your connection.';
    } else {
      return 'An unexpected error occurred. Please try again.';
    }
  }
}

export default AuthService;

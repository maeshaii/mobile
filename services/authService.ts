import * as SecureStore from 'expo-secure-store';
import { loginUser, getAccessToken, getRefreshToken, logoutUser } from './api';

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
    await SecureStore.setItemAsync('accessToken', session.accessToken);
    await SecureStore.setItemAsync('refreshToken', session.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(session.user));
    await SecureStore.setItemAsync('lastLogin', session.lastLogin.toISOString());
    this.currentSession = session;
  }

  async getCurrentSession(): Promise<UserSession | null> {
    if (this.currentSession) return this.currentSession;
    const accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();
    const userStr = await SecureStore.getItemAsync('user');
    const lastLoginStr = await SecureStore.getItemAsync('lastLogin');
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
    const session = await this.getCurrentSession();
    if (!session) return false;
    const now = new Date();
    const tokenAge = now.getTime() - session.lastLogin.getTime();
    const maxAge = 24 * 60 * 60 * 1000;
    if (tokenAge > maxAge) {
      await this.logout();
      return false;
    }
    return true;
  }

  async logout(): Promise<void> {
    await logoutUser();
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('lastLogin');
    this.currentSession = null;
  }

  async getUserInfo(): Promise<any> {
    const userStr = await SecureStore.getItemAsync('user');
    return userStr ? JSON.parse(userStr) : null;
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

export default AuthService.getInstance();

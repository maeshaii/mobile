import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AuthService from '../services/authService';

interface UserContextType {
  user: any;
  isAuthenticated: boolean;
  loading: boolean;
  login: (ctuId: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();

    // 🔒 SECURITY: Real-time token monitoring (Web only - localStorage events)
    // For native, we rely on periodic validation below
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' || e.key === 'refreshToken' || e.key === 'user') {
        if (e.newValue === null) {
          console.warn('[Mobile Security] Auth data removed - logging out');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    // 🔒 SECURITY: Re-validate when app comes back to foreground (Web only)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Mobile Security] App became visible - re-validating auth');
        checkAuthStatus();
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('storage', handleStorageChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // 🔒 SECURITY: Periodic validation every 10 seconds (Native + Web)
    // Faster detection of manual token deletions and token expiration
    const intervalId = setInterval(async () => {
      try {
        const authenticated = await AuthService.getInstance().isAuthenticated();
        if (!authenticated && isAuthenticated) {
          console.warn('[Mobile Security] Periodic check: Session invalid - logging out');
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('[Mobile Security] Periodic validation error:', error);
      }
    }, 10000); // Every 10 seconds (faster detection)

    // Cleanup
    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('storage', handleStorageChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      const authenticated = await AuthService.getInstance().isAuthenticated();
      console.log('[UserContext] 🔍 Auth check result:', authenticated);
      if (authenticated) {
        const userInfo = await AuthService.getInstance().getUserInfo();
        console.log('[UserContext] ✅ Setting authenticated state with user:', userInfo?.id);
        setUser(userInfo);
        setIsAuthenticated(true);
      } else {
        console.log('[UserContext] ❌ Not authenticated - clearing state');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[UserContext] Auth status check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (ctuId: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await AuthService.getInstance().authenticate({
        acc_username: ctuId,
        acc_password: password
      });
      if (response.success && response.user) {
        setUser(response.user);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await AuthService.getInstance().logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    await checkAuthStatus();
  };

  const value: UserContextType = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    refreshUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

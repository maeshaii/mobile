import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useUser } from '../contexts/UserContext';

/**
 * 🔒 SECURITY: Protected Route Hook for Expo Router
 * 
 * Usage in screens:
 * ```tsx
 * export default function MyProtectedScreen() {
 *   useProtectedRoute(); // Redirects to login if not authenticated
 *   // ... rest of component
 * }
 * ```
 * 
 * Features:
 * - Automatic redirect to login for unauthenticated users
 * - Preserves return path for post-login redirect
 * - Integrated with UserContext for real-time auth state
 */
export function useProtectedRoute() {
  const { isAuthenticated, loading } = useUser();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Don't redirect while checking auth status
    if (loading) return;

    // Get current path
    const currentPath = '/' + segments.join('/');

    // Public routes that don't require authentication
    const publicRoutes = [
      '/login',
      '/login/index',
      '/login/login',
      '/forgot-password/forgot-password',
      '/temporary-password/temporary-password',
      '/logout',
    ];

    const isPublicRoute = publicRoutes.includes(currentPath) || 
                         currentPath.startsWith('/login') ||
                         currentPath.startsWith('/forgot-password') ||
                         currentPath.startsWith('/temporary-password');

    // If not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      console.log(`[useProtectedRoute] Redirecting to login from: ${currentPath}`);
      router.replace('/login/login');
      return;
    }

    // If authenticated and trying to access login page, redirect to home
    if (isAuthenticated && currentPath === '/login/login') {
      console.log('[useProtectedRoute] Already authenticated, redirecting to home');
      router.replace('/homepage/home');
    }
  }, [isAuthenticated, loading, segments, router]);
}

/**
 * 🔒 SECURITY: Role-based Protected Route Hook
 * 
 * Usage:
 * ```tsx
 * export default function AdminOnlyScreen() {
 *   useProtectedRoute({ roles: ['admin'] });
 *   // ... rest of component
 * }
 * ```
 */
export function useProtectedRouteWithRole(options?: { roles?: string[] }) {
  const { user, isAuthenticated, loading } = useUser();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const currentPath = '/' + segments.join('/');

    // First check authentication
    if (!isAuthenticated) {
      console.log(`[useProtectedRouteWithRole] Not authenticated, redirecting from: ${currentPath}`);
      router.replace('/login/login');
      return;
    }

    // Then check roles if specified
    if (options?.roles && options.roles.length > 0) {
      const accountType = user?.account_type || {};
      const hasRequiredRole = options.roles.some(role => accountType[role] === true);

      if (!hasRequiredRole) {
        console.warn(
          `[useProtectedRouteWithRole] Insufficient permissions for ${currentPath}. ` +
          `Required: [${options.roles.join(', ')}], User has: [${Object.keys(accountType).filter(k => accountType[k]).join(', ')}]`
        );
        router.replace('/homepage/home'); // Redirect to home instead of login
      }
    }
  }, [isAuthenticated, loading, user, segments, router, options]);
}


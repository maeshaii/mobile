import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { UserProvider, useUser } from '../contexts/UserContext';

/**
 * 🔒 SECURITY: Navigation Guard Component
 * Handles automatic redirects based on authentication state
 * 
 * Security Features:
 * - Real-time authentication monitoring
 * - Prevents authenticated users from accessing login pages
 * - Blocks unauthenticated users from protected routes
 * - Continuous validation (not just on mount)
 */
function NavigationGuard() {
  const { isAuthenticated, loading } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while checking auth status
    if (loading) return;

    const currentPath = '/' + segments.join('/');

    // Define public routes (accessible without authentication)
    const publicRoutes = [
      '',
      'login',
      'login/index',
      'login/login',
      'forgot-password/forgot-password',
      'temporary-password/temporary-password',
      'logout',
    ];

    const isPublicRoute = publicRoutes.includes(segments.join('/'));

    console.log('[NavigationGuard]', {
      currentPath,
      isAuthenticated,
      isPublicRoute,
      segments,
      timestamp: new Date().toISOString()
    });

    // 🔒 SECURITY: Redirect unauthenticated users to login
    if (!isAuthenticated && !isPublicRoute) {
      console.log('[NavigationGuard] 🔒 Redirecting to login - user not authenticated');
      router.replace('/login/login');
      return;
    }

    // 🔒 SECURITY: Redirect authenticated users away from login page
    // This prevents the issue where logged-in users can manually navigate to /login
    if (isAuthenticated && segments.join('/') === 'login/login') {
      console.log('[NavigationGuard] 🔒 Redirecting to home - already authenticated');
      router.replace('/homepage/home');
      return;
    }

    // 🔒 SECURITY: Also check for other auth pages
    const authPages = ['login/index', 'forgot-password/forgot-password', 'temporary-password/temporary-password'];
    if (isAuthenticated && authPages.includes(segments.join('/'))) {
      console.log('[NavigationGuard] 🔒 Redirecting to home - authenticated user on auth page');
      router.replace('/homepage/home');
      return;
    }
  }, [isAuthenticated, loading, segments, router]);

  // 🔒 SECURITY FIX: Periodic validation every 3 seconds
  // Ensures faster detection of authentication changes
  useEffect(() => {
    if (loading) return;

    const intervalId = setInterval(() => {
      const currentSegments = segments.join('/');
      const isOnLoginPage = currentSegments === 'login/login' || 
                            currentSegments === 'login/index' ||
                            currentSegments === 'forgot-password/forgot-password';
      
      // If authenticated and on login page, redirect immediately
      if (isAuthenticated && isOnLoginPage) {
        console.log('[NavigationGuard] Periodic check: Authenticated user on login page - redirecting');
        router.replace('/homepage/home');
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(intervalId);
  }, [isAuthenticated, loading, segments, router]);

  return null;
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Suppress font download errors for Expo Go (fonts are already bundled)
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Suppress font download errors - Expo Go includes vector icons fonts
    if (
      error?.message?.includes('Unable to download asset') &&
      error?.message?.includes('Ionicons.ttf')
    ) {
      console.warn('Font download error suppressed (fonts are bundled in Expo Go):', error.message);
      return;
    }
    // Call original handler for other errors
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Also handle unhandled promise rejections
if (typeof global !== 'undefined') {
  const originalRejectionHandler = (global as any).onunhandledrejection;
  (global as any).onunhandledrejection = (event: any) => {
    const error = event?.reason || event;
    // Suppress font download promise rejections
    if (
      error?.message?.includes('Unable to download asset') &&
      error?.message?.includes('Ionicons.ttf')
    ) {
      console.warn('Font download promise rejection suppressed (fonts are bundled in Expo Go):', error.message);
      if (event?.preventDefault) {
        event.preventDefault();
      }
      return;
    }
    // Call original handler for other rejections
    if (originalRejectionHandler && typeof originalRejectionHandler === 'function') {
      originalRejectionHandler.call(global, event);
    }
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      // Hide the splash screen once fonts are loaded (or if there's an error)
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    // Keep showing splash screen while fonts are loading
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        {/* 🔒 SECURITY: Centralized navigation guard */}
        <NavigationGuard />
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            {/* Public Routes */}
            <Stack.Screen name="login/index" options={{ title: 'landing', headerShown: false }} />
            <Stack.Screen name="logout" options={{ title: 'logout', headerShown: false }} />
            <Stack.Screen name="login/login" options={{ title: 'login', headerShown: false }} />
            <Stack.Screen name="forgot-password/forgot-password" options={{ title: 'forgot-password', headerShown: false }} />
            <Stack.Screen name="temporary-password/temporary-password" options={{ title: 'temporary-password', headerShown: false }} />
            
            {/* 🔒 Protected Routes - Require Authentication */}
            <Stack.Screen name="(tabs)/index" options={{ title: 'index', headerShown: false }} />
            <Stack.Screen name="homepage/home" options={{ title: 'homepage', headerShown: false }} />
            <Stack.Screen name="posts/post" options={{ title: 'post', headerShown: false }} />
            <Stack.Screen name="notifications/notification" options={{ title: 'notification', headerShown: false }} />
            <Stack.Screen name="messages/message" options={{ title: 'message', headerShown: false }} />
            <Stack.Screen name="messages/chatmessage" options={{ title: 'chatmessage', headerShown: false }} />
            <Stack.Screen name="messages/search" options={{ title: 'search', headerShown: false }} />
            <Stack.Screen name="profile/profiletab" options={{ title: 'profiletab', headerShown: false }} />
            <Stack.Screen name="profile/profilepage" options={{ title: 'profilepage', headerShown: false }} />
            <Stack.Screen name="ccict/ccictpage" options={{ title: 'ccict', headerShown: false }} />
            <Stack.Screen name="peso/pesopage" options={{ title: 'peso', headerShown: false }} />
            <Stack.Screen name="forum/forumpage" options={{ title: 'forum', headerShown: false }} />
            <Stack.Screen name="ojt/ojtpage" options={{ title: 'ojt', headerShown: false }} />
            <Stack.Screen name="ojt/ojtforum" options={{ title: 'ojt-forum', headerShown: false }} />
            <Stack.Screen name="ojt/ojtdonation" options={{ title: 'ojt-donation', headerShown: false }} />
            <Stack.Screen name="ojt/ojtprofile" options={{ title: 'ojt-profile', headerShown: false }} />
            <Stack.Screen name="ojt/ojtsettings" options={{ title: 'ojt-settings', headerShown: false }} />
            <Stack.Screen name="settings/settings" options={{ title: 'settings', headerShown: false }} />
            <Stack.Screen name="search/search" options={{ title: 'search', headerShown: false }} />
            <Stack.Screen name="forms/forms" options={{ title: 'forms', headerShown: false }} />
            <Stack.Screen name="posts/comments" options={{ title: 'comments', headerShown: false }} />
            <Stack.Screen name="otheruser/otheruser" options={{ title: 'otheruser', headerShown: false }} />
            <Stack.Screen name="posts/detail" options={{ title: 'repostorig', headerShown: false }} />
            <Stack.Screen name="donation/donationpage" options={{ title: 'donation', headerShown: false }} />
            <Stack.Screen name="repost/repost" options={{ title: 'repost', headerShown: false }} />
            <Stack.Screen name="repost/repost-comments" options={{ title: 'repost-comments', headerShown: false }} />
            <Stack.Screen name="donation/donation-repost" options={{ title: 'donation-repost', headerShown: false }} />
            <Stack.Screen name="rewards/rewards" options={{ title: 'rewards', headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </UserProvider>
    </GestureHandlerRootView>
  );
}

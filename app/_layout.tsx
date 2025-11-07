import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/useColorScheme';
import { UserProvider } from '../contexts/UserContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack initialRouteName="login/login">
            <Stack.Screen name="login/login" options={{ title: 'login', headerShown: false }} />
            <Stack.Screen name="(tabs)/index" options={{ title: 'index', headerShown: false }} />
            <Stack.Screen name="forgot-password/forgot-password" options={{ title: 'forgot-password', headerShown: false }} />
            <Stack.Screen name="temporary-password/temporary-password" options={{ title: 'temporary-password', headerShown: false }} />
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

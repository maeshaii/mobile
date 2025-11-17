import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Redirect to login landing page
    router.replace('/login');
  }, []);

  return null;
}


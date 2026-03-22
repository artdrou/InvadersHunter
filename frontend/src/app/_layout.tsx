import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth';

export default function RootLayout() {
  const token = useAuthStore((s) => s.token);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inPublicScreen = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password';
    if (!token && !inPublicScreen) {
      router.replace('/login');
    } else if (token && inPublicScreen) {
      router.replace('/(tabs)/map');
    }
  }, [token, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

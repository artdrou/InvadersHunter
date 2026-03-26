import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth';
import { ThemeProvider } from '@/contexts/theme-context';

export default function RootLayout() {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return; // wait for AsyncStorage to load before redirecting
    const inPublicScreen = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password';
    if (!token && !inPublicScreen) {
      router.replace('/login');
    } else if (token && inPublicScreen) {
      router.replace('/(tabs)/map');
    }
  }, [token, segments, hasHydrated]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useAuthStore } from '@/features/auth';
import { ThemeProvider } from '@/contexts/theme-context';
import { initDb } from '@/services/db';
import { initI18n } from '@/services/i18n';
import {
  UpdateAvailableModal,
  useAppUpdateStore,
  fetchVersionManifest,
  getCurrentVersion,
  isNewer,
} from '@/features/app-update';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const segments = useSegments();
  const router = useRouter();
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().finally(() => setI18nReady(true));
  }, []);

  const [fontsLoaded] = useFonts({
    Pix32:      require('../../assets/fonts/Pix32/Pix32.ttf'),
    Pixeled:    require('../../assets/fonts/pixeled/Pixeled.ttf'),
    Dogica:     require('../../assets/fonts/dogica/TTF/dogica.ttf'),
    Pixelmania: require('../../assets/fonts/pixelmania/Pixelmania.ttf'),
    Pixelmix:   require('../../assets/fonts/pixelmix/pixelmix.ttf'),
    Pixelade:   require('../../assets/fonts/pixelade/pixelade.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded && i18nReady) SplashScreen.hideAsync();
  }, [fontsLoaded, i18nReady]);

  useEffect(() => {
    (async () => {
      await useAppUpdateStore.getState().hydrate();
      const manifest = await fetchVersionManifest();
      if (manifest && isNewer(manifest.latestVersion, getCurrentVersion())) {
        useAppUpdateStore.getState().setManifest(manifest);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    const inPublicScreen = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password';
    if (!token && !inPublicScreen) {
      router.replace('/login');
    } else if (token && inPublicScreen) {
      router.replace('/(tabs)/map');
    }
  }, [token, segments, hasHydrated]);

  if (!fontsLoaded || !i18nReady) return null;

  return (
    <SQLiteProvider databaseName="invaders.db" onInit={initDb}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <UpdateAvailableModal />
      </ThemeProvider>
    </SQLiteProvider>
  );
}

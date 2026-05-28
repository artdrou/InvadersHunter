/**
 * Persisted user preference for haptic feedback. Components that vibrate
 * should gate their call on `useHapticsStore.getState().enabled` so the user
 * can turn vibrations off entirely.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app-haptics-enabled';

type HapticsState = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  hydrate: () => Promise<void>;
};

export const useHapticsStore = create<HapticsState>((set) => ({
  enabled: true, // default on; the user opted in by installing the app

  setEnabled: (v) => {
    set({ enabled: v });
    AsyncStorage.setItem(STORAGE_KEY, v ? '1' : '0').catch(() => {});
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored !== null) set({ enabled: stored === '1' });
    } catch {}
  },
}));

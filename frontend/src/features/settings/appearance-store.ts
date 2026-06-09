import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROUTE_GLOW_KEY = 'app-route-glow-enabled';

type AppearanceState = {
  routeGlowEnabled: boolean;
  setRouteGlowEnabled: (v: boolean) => void;
  hydrate: () => Promise<void>;
};

export const useAppearanceStore = create<AppearanceState>((set) => ({
  routeGlowEnabled: true,

  setRouteGlowEnabled: (v) => {
    set({ routeGlowEnabled: v });
    AsyncStorage.setItem(ROUTE_GLOW_KEY, v ? '1' : '0').catch(() => {});
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(ROUTE_GLOW_KEY);
      if (stored !== null) set({ routeGlowEnabled: stored === '1' });
    } catch {}
  },
}));

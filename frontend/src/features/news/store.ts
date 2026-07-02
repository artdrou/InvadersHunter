import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsItem } from './types';
import { fetchNews } from './services/news.api';

/**
 * Drives the unread badge shown on the map and the Invaders tab.
 * We cache the recent (30-day) feed and remember the newest item the user has seen.
 * All dates are the backend's own ISO strings, so unread = plain string comparison.
 */
type NewsState = {
  items: NewsItem[];
  lastSeenAt: string | null;
  _hasHydrated: boolean;
  refreshRecent: () => Promise<void>;
  setItems: (items: NewsItem[]) => void;
  markAllSeen: () => void;
  setHasHydrated: (v: boolean) => void;
};

export const useNewsStore = create<NewsState>()(
  persist(
    (set) => ({
      items: [],
      lastSeenAt: null,
      _hasHydrated: false,
      refreshRecent: async () => {
        try {
          const items = await fetchNews();
          set({ items });
        } catch {
          // offline / error: keep whatever is cached
        }
      },
      setItems: (items) => set({ items }),
      markAllSeen: () => set((s) => ({ lastSeenAt: s.items[0]?.date ?? s.lastSeenAt })),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'news-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items, lastSeenAt: s.lastSeenAt }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

/** Number of feed items newer than the last one the user saw (uncapped). */
export function useNewsUnreadCount(): number {
  return useNewsStore((s) =>
    s.lastSeenAt ? s.items.filter((i) => i.date > s.lastSeenAt!).length : s.items.length,
  );
}

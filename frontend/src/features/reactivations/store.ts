import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseServerDate } from '@/features/news/types';
import { REACTIVATED_DAYS, type Reactivation } from './types';
import { fetchReactivations } from './services/reactivations.api';

/**
 * Recently reactivated invaders, for the map's "State" color mode. Cached for
 * offline use; dates are re-checked so a stale cache doesn't keep them magenta.
 */
type ReactivationsState = {
  items: Reactivation[];
  refresh: () => Promise<void>;
};

export const useReactivationsStore = create<ReactivationsState>()(
  persist(
    (set) => ({
      items: [],
      refresh: async () => {
        try {
          set({ items: await fetchReactivations() });
        } catch {
          // offline / older backend: keep whatever is cached
        }
      },
    }),
    {
      name: 'reactivations-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

/** Ids of the invaders reactivated within the last REACTIVATED_DAYS days. */
export function reactivatedIds(items: Reactivation[], now: number = Date.now()): Set<number> {
  const cutoff = now - REACTIVATED_DAYS * 24 * 60 * 60 * 1000;
  return new Set(items.filter((r) => parseServerDate(r.date).getTime() >= cutoff).map((r) => r.invader_id));
}

export function useReactivatedIds(): Set<number> {
  const items = useReactivationsStore((s) => s.items);
  return useMemo(() => reactivatedIds(items), [items]);
}

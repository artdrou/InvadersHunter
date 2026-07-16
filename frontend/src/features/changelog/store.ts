import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tracks the last release version whose patch notes the user has seen,
 * so the WhatsNewModal shows exactly once per release.
 */
type ChangelogState = {
  lastSeenVersion: string | null;
  _hasHydrated: boolean;
  markSeen: (version: string) => void;
  setHasHydrated: (val: boolean) => void;
};

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set) => ({
      lastSeenVersion: null,
      _hasHydrated: false,
      markSeen: (version) => set({ lastSeenVersion: version }),
      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: 'changelog-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lastSeenVersion: s.lastSeenVersion }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

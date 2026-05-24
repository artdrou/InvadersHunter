/**
 * Tracks which "latest version" the user has already dismissed, so we don't
 * pester them every launch. A new version not yet seen → re-prompts once.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VersionManifest } from './types';

const STORAGE_KEY = 'app-update-dismissed-version';

type UpdateState = {
  manifest: VersionManifest | null;
  isAvailable: boolean;
  dismissedVersion: string | null;
  setManifest: (m: VersionManifest | null) => void;
  setDismissedVersion: (v: string | null) => void;
  dismiss: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAppUpdateStore = create<UpdateState>((set, get) => ({
  manifest: null,
  isAvailable: false,
  dismissedVersion: null,

  setManifest: (m) => {
    const dismissed = get().dismissedVersion;
    const available = !!m && m.latestVersion !== dismissed;
    set({ manifest: m, isAvailable: available });
  },

  setDismissedVersion: (v) => set({ dismissedVersion: v }),

  dismiss: async () => {
    const m = get().manifest;
    if (!m) return;
    try { await AsyncStorage.setItem(STORAGE_KEY, m.latestVersion); } catch {}
    set({ dismissedVersion: m.latestVersion, isAvailable: false });
  },

  hydrate: async () => {
    try {
      const v = await AsyncStorage.getItem(STORAGE_KEY);
      set({ dismissedVersion: v });
    } catch {}
  },
}));

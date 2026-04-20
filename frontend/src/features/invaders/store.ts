import { create } from 'zustand';
import type { Invader, Capture } from './types';

type SyncError = 'network' | 'other' | null;

type InvaderStoreState = {
  invaders: Invader[];
  progress: Capture[];
  isSyncing: boolean;
  syncError: SyncError;
  setInvaders: (invaders: Invader[]) => void;
  setProgress: (updater: Capture[] | ((prev: Capture[]) => Capture[])) => void;
  setIsSyncing: (v: boolean) => void;
  setSyncError: (v: SyncError) => void;
};

export const useInvaderStore = create<InvaderStoreState>((set) => ({
  invaders: [],
  progress: [],
  isSyncing: false,
  syncError: null,
  setInvaders: (invaders) => set({ invaders }),
  setProgress: (updater) =>
    set((state) => ({
      progress: typeof updater === 'function' ? updater(state.progress) : updater,
    })),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setSyncError: (syncError) => set({ syncError }),
}));

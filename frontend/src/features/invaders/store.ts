import { create } from 'zustand';
import type { Invader, Capture } from './types';

type SyncError = 'network' | 'other' | null;

type InvaderStoreState = {
  invaders: Invader[];
  progress: Capture[];
  isSyncing: boolean;
  syncError: SyncError;
  syncTrigger: number;
  setInvaders: (invaders: Invader[]) => void;
  setProgress: (updater: Capture[] | ((prev: Capture[]) => Capture[])) => void;
  setIsSyncing: (v: boolean) => void;
  setSyncError: (v: SyncError) => void;
  requestSync: () => void;
};

export const useInvaderStore = create<InvaderStoreState>((set) => ({
  invaders: [],
  progress: [],
  isSyncing: false,
  syncError: null,
  syncTrigger: 0,
  setInvaders: (invaders) => set({ invaders }),
  setProgress: (updater) =>
    set((state) => ({
      progress: typeof updater === 'function' ? updater(state.progress) : updater,
    })),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setSyncError: (syncError) => set({ syncError }),
  requestSync: () => set((s) => ({ syncTrigger: s.syncTrigger + 1 })),
}));

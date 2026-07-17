import { create } from 'zustand';
import type { CustomInvader } from './types';

type CustomInvaderStoreState = {
  customInvaders: CustomInvader[];
  setCustomInvaders: (updater: CustomInvader[] | ((prev: CustomInvader[]) => CustomInvader[])) => void;
};

/**
 * Personal invaders currently loaded from SQLite. Filled by useInvaderData's
 * loadFromDb (the single load path shared with invaders/captures) and mutated
 * optimistically by useCustomInvaders.
 */
export const useCustomInvaderStore = create<CustomInvaderStoreState>((set) => ({
  customInvaders: [],
  setCustomInvaders: (updater) =>
    set((state) => ({
      customInvaders: typeof updater === 'function' ? updater(state.customInvaders) : updater,
    })),
}));

import { create } from 'zustand';

type LocateStore = {
  pendingInvaderId: number | null;
  setPendingInvader: (id: number | null) => void;
};

export const useLocateStore = create<LocateStore>()((set) => ({
  pendingInvaderId: null,
  setPendingInvader: (id) => set({ pendingInvaderId: id }),
}));

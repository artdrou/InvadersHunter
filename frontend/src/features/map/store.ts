import { create } from 'zustand';

type LocateStore = {
  pendingInvaderId: number | null;
  /** Open the invader's popup straight in edit mode (Update from the list). */
  pendingEdit: boolean;
  setPendingInvader: (id: number | null, edit?: boolean) => void;
};

export const useLocateStore = create<LocateStore>()((set) => ({
  pendingInvaderId: null,
  pendingEdit: false,
  setPendingInvader: (id, edit = false) => set({ pendingInvaderId: id, pendingEdit: id != null && edit }),
}));

type HeadingStore = {
  heading: number;
  setHeading: (h: number) => void;
};

export const useHeadingStore = create<HeadingStore>()((set) => ({
  heading: 0,
  setHeading: (heading) => set({ heading }),
}));

import { create } from 'zustand';

type PickedLocation = { invaderId: number; lat: number; lon: number };

type LocateStore = {
  pendingInvaderId: number | null;
  setPendingInvader: (id: number | null) => void;
  /** List view: open the map's location picker for this invader, then go back to the list. */
  pickForList: number | null;
  setPickForList: (id: number | null) => void;
  /** Location picked for the list's edit form (consumed by the list). */
  pickedForList: PickedLocation | null;
  setPickedForList: (picked: PickedLocation | null) => void;
};

export const useLocateStore = create<LocateStore>()((set) => ({
  pendingInvaderId: null,
  setPendingInvader: (id) => set({ pendingInvaderId: id }),
  pickForList: null,
  setPickForList: (id) => set({ pickForList: id }),
  pickedForList: null,
  setPickedForList: (picked) => set({ pickedForList: picked }),
}));

type HeadingStore = {
  heading: number;
  setHeading: (h: number) => void;
};

export const useHeadingStore = create<HeadingStore>()((set) => ({
  heading: 0,
  setHeading: (heading) => set({ heading }),
}));

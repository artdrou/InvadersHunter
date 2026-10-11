import { create } from 'zustand';

/** Screens whose invader list can open the map's location picker and get the result back. */
export type PickReturnTarget = "invaders" | "incomplete";
export const PICK_RETURN_ROUTES: Record<PickReturnTarget, "/(tabs)/invader" | "/incomplete"> = {
  invaders: "/(tabs)/invader",
  incomplete: "/incomplete",
};

type PickRequest = { invaderId: number; target: PickReturnTarget };
type PickedLocation = PickRequest & { lat: number; lon: number };

type LocateStore = {
  pendingInvaderId: number | null;
  setPendingInvader: (id: number | null) => void;
  /** A list asks the map to open its location picker for this invader, then go back to it. */
  pickForList: PickRequest | null;
  setPickForList: (req: PickRequest | null) => void;
  /** Location picked for a list's edit form (consumed by the list of `target` only). */
  pickedForList: PickedLocation | null;
  setPickedForList: (picked: PickedLocation | null) => void;
};

export const useLocateStore = create<LocateStore>()((set) => ({
  pendingInvaderId: null,
  setPendingInvader: (id) => set({ pendingInvaderId: id }),
  pickForList: null,
  setPickForList: (req) => set({ pickForList: req }),
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

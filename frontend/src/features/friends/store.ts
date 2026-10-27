import { create } from 'zustand';
import type { FriendsOverview, FriendMapView } from './types';
import { fetchFriendsOverview, fetchFriendCode } from './services/friends.api';

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [] };

type FriendsStore = {
  overview: FriendsOverview;
  loaded: boolean;
  /** Refetch friends + invites. Errors keep the last known list. Returns false on failure. */
  load: () => Promise<boolean>;
  /** My friend code, once fetched (it never changes). */
  myCode: string | null;
  loadCode: () => Promise<void>;
  /** Whose map the map tab shows (null = my own). Not persisted. */
  mapView: FriendMapView | null;
  setMapView: (view: FriendMapView | null) => void;
  reset: () => void;
};

export const useFriendsStore = create<FriendsStore>()((set) => ({
  overview: EMPTY,
  loaded: false,
  load: async () => {
    try {
      set({ overview: await fetchFriendsOverview(), loaded: true });
      return true;
    } catch {
      return false;
    }
  },
  myCode: null,
  loadCode: async () => {
    try {
      set({ myCode: await fetchFriendCode() });
    } catch {
      // offline: the card keeps its placeholder, retried on the next focus
    }
  },
  mapView: null,
  setMapView: (mapView) => set({ mapView }),
  reset: () => set({ overview: EMPTY, loaded: false, myCode: null, mapView: null }),
}));

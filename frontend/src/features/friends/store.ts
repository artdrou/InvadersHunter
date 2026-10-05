import { create } from 'zustand';
import type { FriendsOverview, FriendMapView } from './types';
import { fetchFriendsOverview } from './services/friends.api';

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [] };

type FriendsStore = {
  overview: FriendsOverview;
  loaded: boolean;
  /** Refetch friends + invites. Errors keep the last known list. Returns false on failure. */
  load: () => Promise<boolean>;
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
  mapView: null,
  setMapView: (mapView) => set({ mapView }),
  reset: () => set({ overview: EMPTY, loaded: false, mapView: null }),
}));

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROUTE_GLOW_KEY       = 'app-route-glow-enabled';
const CLUSTERING_KEY       = 'app-clustering-enabled';
const CLUSTER_MAX_ZOOM_KEY = 'app-cluster-max-zoom';

// Clustering threshold bounds. Points cluster at zoom <= clusterMaxZoom and
// split into individual markers above it. Keep in sync with the stepper range
// in the appearance screen.
export const CLUSTER_MAX_ZOOM_MIN     = 4;
export const CLUSTER_MAX_ZOOM_MAX     = 16;
export const CLUSTER_MAX_ZOOM_DEFAULT = 10;

type AppearanceState = {
  routeGlowEnabled: boolean;
  setRouteGlowEnabled: (v: boolean) => void;

  clusteringEnabled: boolean;
  setClusteringEnabled: (v: boolean) => void;

  clusterMaxZoom: number;
  setClusterMaxZoom: (v: number) => void;

  hydrate: () => Promise<void>;
};

function clampZoom(v: number): number {
  if (Number.isNaN(v)) return CLUSTER_MAX_ZOOM_DEFAULT;
  return Math.min(CLUSTER_MAX_ZOOM_MAX, Math.max(CLUSTER_MAX_ZOOM_MIN, Math.round(v)));
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  routeGlowEnabled: true,

  setRouteGlowEnabled: (v) => {
    set({ routeGlowEnabled: v });
    AsyncStorage.setItem(ROUTE_GLOW_KEY, v ? '1' : '0').catch(() => {});
  },

  clusteringEnabled: true,

  setClusteringEnabled: (v) => {
    set({ clusteringEnabled: v });
    AsyncStorage.setItem(CLUSTERING_KEY, v ? '1' : '0').catch(() => {});
  },

  clusterMaxZoom: CLUSTER_MAX_ZOOM_DEFAULT,

  setClusterMaxZoom: (v) => {
    const zoom = clampZoom(v);
    set({ clusterMaxZoom: zoom });
    AsyncStorage.setItem(CLUSTER_MAX_ZOOM_KEY, String(zoom)).catch(() => {});
  },

  hydrate: async () => {
    try {
      const [glow, clustering, maxZoom] = await Promise.all([
        AsyncStorage.getItem(ROUTE_GLOW_KEY),
        AsyncStorage.getItem(CLUSTERING_KEY),
        AsyncStorage.getItem(CLUSTER_MAX_ZOOM_KEY),
      ]);
      const patch: Partial<AppearanceState> = {};
      if (glow !== null)       patch.routeGlowEnabled  = glow === '1';
      if (clustering !== null) patch.clusteringEnabled = clustering === '1';
      if (maxZoom !== null)     patch.clusterMaxZoom    = clampZoom(Number(maxZoom));
      if (Object.keys(patch).length) set(patch);
    } catch {}
  },
}));

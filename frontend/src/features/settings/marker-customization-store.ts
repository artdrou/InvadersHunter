import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIER_VALUES, type TierPts, type MarkerColorPrefs } from '@/features/marker-customization/types';
import { generateMarkerSet, clearMarkerSet, type GeneratedMarkerSet } from '@/features/marker-customization/generate-markers';

const SHAPE_FOR_TIER_KEY = 'app-marker-shape-for-tier';
const COLORS_KEY = 'app-marker-colors';
const OPACITY_KEY = 'app-marker-opacity';
const CUSTOM_ICON_URIS_KEY = 'app-marker-custom-icon-uris';

export const DEFAULT_SHAPE_FOR_TIER: Record<TierPts, TierPts> = { 10: 10, 20: 20, 30: 30, 40: 40, 50: 50, 100: 100 };

export const DEFAULT_MARKER_COLORS: MarkerColorPrefs = {
  flashCaptured: { icon: '#1CF0FF', glow: '#002FA7' },
  flashUncaptured: { icon: '#FF0062', glow: '#A300B3' },
  highlight: { icon: '#FFC107', glow: '#FF7A00' },
  grey: { icon: '#C8C8C8', glow: '#888888' },
};

type MarkerCustomizationState = {
  shapeForTier: Record<TierPts, TierPts>;
  colors: MarkerColorPrefs;
  opacity: number;
  customIconUris: GeneratedMarkerSet | null;
  isGenerating: boolean;
  isDirty: boolean; // true when shapeForTier/colors changed since the last successful regenerate()

  setShapeForTier: (tier: TierPts, shapeId: TierPts) => void;
  setColor: (state: keyof MarkerColorPrefs, kind: 'icon' | 'glow', hex: string) => void;
  setOpacity: (v: number) => void;
  regenerate: () => Promise<void>;
  reset: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useMarkerCustomizationStore = create<MarkerCustomizationState>((set, get) => ({
  shapeForTier: DEFAULT_SHAPE_FOR_TIER,
  colors: DEFAULT_MARKER_COLORS,
  opacity: 1,
  customIconUris: null,
  isGenerating: false,
  isDirty: false,

  setShapeForTier: (tier, shapeId) => {
    set((s) => ({ shapeForTier: { ...s.shapeForTier, [tier]: shapeId }, isDirty: true }));
  },

  setColor: (state, kind, hex) => {
    set((s) => ({
      colors: { ...s.colors, [state]: { ...s.colors[state], [kind]: hex } },
      isDirty: true,
    }));
  },

  setOpacity: (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    set({ opacity: clamped });
    AsyncStorage.setItem(OPACITY_KEY, String(clamped)).catch(() => {});
  },

  regenerate: async () => {
    const { shapeForTier, colors } = get();
    set({ isGenerating: true });
    try {
      const uris = await generateMarkerSet(shapeForTier, colors);
      set({ customIconUris: uris, isGenerating: false, isDirty: false });
      await Promise.all([
        AsyncStorage.setItem(SHAPE_FOR_TIER_KEY, JSON.stringify(shapeForTier)),
        AsyncStorage.setItem(COLORS_KEY, JSON.stringify(colors)),
        AsyncStorage.setItem(CUSTOM_ICON_URIS_KEY, JSON.stringify(uris)),
      ]);
    } catch (err) {
      set({ isGenerating: false });
      throw err;
    }
  },

  reset: async () => {
    await clearMarkerSet();
    set({
      shapeForTier: DEFAULT_SHAPE_FOR_TIER,
      colors: DEFAULT_MARKER_COLORS,
      customIconUris: null,
      isDirty: false,
    });
    await Promise.all([
      AsyncStorage.removeItem(SHAPE_FOR_TIER_KEY),
      AsyncStorage.removeItem(COLORS_KEY),
      AsyncStorage.removeItem(CUSTOM_ICON_URIS_KEY),
    ]);
  },

  hydrate: async () => {
    try {
      const [shapeForTierRaw, colorsRaw, opacityRaw, urisRaw] = await Promise.all([
        AsyncStorage.getItem(SHAPE_FOR_TIER_KEY),
        AsyncStorage.getItem(COLORS_KEY),
        AsyncStorage.getItem(OPACITY_KEY),
        AsyncStorage.getItem(CUSTOM_ICON_URIS_KEY),
      ]);
      const patch: Partial<MarkerCustomizationState> = {};
      if (shapeForTierRaw) patch.shapeForTier = sanitizeShapeForTier(JSON.parse(shapeForTierRaw));
      if (colorsRaw) patch.colors = JSON.parse(colorsRaw);
      if (opacityRaw !== null) patch.opacity = Math.max(0, Math.min(1, Number(opacityRaw)));
      if (urisRaw) patch.customIconUris = JSON.parse(urisRaw);
      if (Object.keys(patch).length) set(patch);
    } catch {}
  },
}));

function sanitizeShapeForTier(raw: Record<string, number>): Record<TierPts, TierPts> {
  const out = { ...DEFAULT_SHAPE_FOR_TIER };
  for (const tier of TIER_VALUES) {
    const v = raw[String(tier)];
    if (v != null && TIER_VALUES.includes(v as TierPts)) out[tier] = v as TierPts;
  }
  return out;
}

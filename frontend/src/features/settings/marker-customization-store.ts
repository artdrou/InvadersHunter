import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIER_VALUES, type TierPts, type CustomizableState, type MarkerColorPrefs, type MarkerPalette } from '@/features/marker-customization/types';
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

const CUSTOMIZABLE_STATES: CustomizableState[] = ['flashCaptured', 'flashUncaptured', 'highlight', 'grey'];

type MarkerCustomizationState = {
  shapeForTier: Record<TierPts, TierPts>;
  colors: MarkerColorPrefs;
  opacity: number;
  customIconUris: GeneratedMarkerSet | null;
  // Bumped every time customIconUris meaningfully changes (successful
  // regenerate or reset). MapLibre's native Images component only ever
  // registers a given key once and ignores later value updates for it, so
  // WebMap.native.tsx keys <Images> on this to force a full remount —
  // without it, a re-customization would never reach an already-mounted map.
  generationVersion: number;
  isGenerating: boolean;
  isDirty: boolean; // true when shapeForTier/colors changed since the last successful regenerate()

  setShapeForTier: (tier: TierPts, shapeId: TierPts) => void;
  setColor: (state: keyof MarkerColorPrefs, kind: 'icon' | 'glow', hex: string) => void;
  setOpacity: (v: number) => void;
  regenerate: () => Promise<void>;
  reset: () => Promise<void>;
  hydrate: () => Promise<void>;
};

// Sequences regenerate()/reset() calls so a regenerate() that resolves after
// being superseded by a later reset()/regenerate() doesn't clobber the
// newer state with its now-stale result.
let operationSeq = 0;

export const useMarkerCustomizationStore = create<MarkerCustomizationState>((set, get) => ({
  shapeForTier: DEFAULT_SHAPE_FOR_TIER,
  colors: DEFAULT_MARKER_COLORS,
  opacity: 1,
  customIconUris: null,
  generationVersion: 0,
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
    const myOp = ++operationSeq;
    const { shapeForTier, colors } = get();
    set({ isGenerating: true });

    let uris: GeneratedMarkerSet;
    try {
      uris = await generateMarkerSet(shapeForTier, colors);
    } catch (err) {
      if (myOp === operationSeq) set({ isGenerating: false });
      throw err;
    }

    // Superseded by a reset() or another regenerate() while this one was
    // working — the newer operation already owns customIconUris/storage.
    if (myOp !== operationSeq) return;

    try {
      await Promise.all([
        AsyncStorage.setItem(SHAPE_FOR_TIER_KEY, JSON.stringify(shapeForTier)),
        AsyncStorage.setItem(COLORS_KEY, JSON.stringify(colors)),
        AsyncStorage.setItem(CUSTOM_ICON_URIS_KEY, JSON.stringify(uris)),
      ]);
    } catch (err) {
      // Don't pretend success if persistence failed — leave isDirty/customIconUris
      // as they were so the UI doesn't imply a save that won't survive a restart.
      set({ isGenerating: false });
      throw err;
    }

    set((s) => ({ customIconUris: uris, generationVersion: s.generationVersion + 1, isGenerating: false, isDirty: false }));
  },

  reset: async () => {
    operationSeq++;
    await clearMarkerSet();
    set((s) => ({
      shapeForTier: DEFAULT_SHAPE_FOR_TIER,
      colors: DEFAULT_MARKER_COLORS,
      customIconUris: null,
      generationVersion: s.generationVersion + 1,
      isGenerating: false,
      isDirty: false,
    }));
    await Promise.all([
      AsyncStorage.removeItem(SHAPE_FOR_TIER_KEY),
      AsyncStorage.removeItem(COLORS_KEY),
      AsyncStorage.removeItem(CUSTOM_ICON_URIS_KEY),
    ]);
  },

  hydrate: async () => {
    // Each key is parsed independently so a single corrupt/legacy entry
    // (e.g. after a schema change) can't silently discard the others.
    let shapeForTierRaw: string | null = null;
    let colorsRaw: string | null = null;
    let opacityRaw: string | null = null;
    let urisRaw: string | null = null;
    try {
      [shapeForTierRaw, colorsRaw, opacityRaw, urisRaw] = await Promise.all([
        AsyncStorage.getItem(SHAPE_FOR_TIER_KEY),
        AsyncStorage.getItem(COLORS_KEY),
        AsyncStorage.getItem(OPACITY_KEY),
        AsyncStorage.getItem(CUSTOM_ICON_URIS_KEY),
      ]);
    } catch {
      return;
    }

    const patch: Partial<MarkerCustomizationState> = {};
    try { if (shapeForTierRaw) patch.shapeForTier = sanitizeShapeForTier(JSON.parse(shapeForTierRaw)); } catch {}
    try { if (colorsRaw) patch.colors = sanitizeColors(JSON.parse(colorsRaw)); } catch {}
    try {
      if (opacityRaw !== null) {
        const n = Number(opacityRaw);
        if (Number.isFinite(n)) patch.opacity = Math.max(0, Math.min(1, n));
      }
    } catch {}
    try { if (urisRaw) patch.customIconUris = JSON.parse(urisRaw); } catch {}

    if (Object.keys(patch).length) set(patch);
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

function isValidHex(hex: unknown): hex is string {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex);
}

function isValidPalette(p: unknown): p is MarkerPalette {
  return !!p && typeof p === 'object' && isValidHex((p as MarkerPalette).icon) && isValidHex((p as MarkerPalette).glow);
}

function sanitizeColors(raw: Partial<Record<CustomizableState, unknown>>): MarkerColorPrefs {
  const out = { ...DEFAULT_MARKER_COLORS };
  for (const state of CUSTOMIZABLE_STATES) {
    const v = raw[state];
    if (isValidPalette(v)) out[state] = v;
  }
  return out;
}

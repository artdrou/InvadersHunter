import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIER_VALUES, type TierPts, type CustomizableState, type MarkerColorPrefs, type MarkerPalette } from '@/features/marker-customization/types';
import { generateMarkerSet, clearMarkerSet, resolveMarkerSet, DEFAULT_BLOOM_INDEX, BLOOM_LEVEL_COUNT, type GeneratedMarkerSet, type GenerationResult } from '@/features/marker-customization/generate-markers';

const SHAPE_FOR_TIER_KEY = 'app-marker-shape-for-tier';
const COLORS_KEY = 'app-marker-colors';
const OPACITY_KEY = 'app-marker-opacity';
const BLOOM_KEY = 'app-marker-bloom';
const CUSTOM_ENABLED_KEY = 'app-marker-custom-enabled';
// We persist only the generation *folder name* (relative), not the absolute
// file:// URIs — the document-directory path isn't stable across app updates
// on iOS, so absolute URIs would dangle. The live URIs are rebuilt on hydrate.
const GENERATION_DIR_KEY = 'app-marker-generation-dir';

export const DEFAULT_SHAPE_FOR_TIER: Record<TierPts, TierPts> = { 10: 10, 20: 20, 30: 30, 40: 40, 50: 50, 100: 100 };

export const DEFAULT_MARKER_COLORS: MarkerColorPrefs = {
  flashCaptured: { icon: '#1CF0FF', glow: '#002FA7' },
  flashUncaptured: { icon: '#FF0062', glow: '#A300B3' },
  highlight: { icon: '#FFC107', glow: '#FF7A00' },
  grey: { icon: '#C8C8C8', glow: '#888888' },
  // Personal invaders, when the custom palette is switched on. Green by default
  // so it reads apart from the pink/blue community markers out of the box.
  custom: { icon: '#1CFFB7', glow: '#00A36C' },
};

// Per-state opacity applied live on the map (see useMarkerLayerStyle). The
// grey default of 0.8 reproduces the old fixed grey-mode dimming so the map
// looks identical until the user actually changes something.
export const DEFAULT_MARKER_OPACITY: Record<CustomizableState, number> = {
  flashCaptured: 1,
  flashUncaptured: 1,
  highlight: 1,
  grey: 0.8,
  custom: 1,
};

// Per-state bloom (glow size x intensity), stored as a 0..8 preset index. Baked
// into the PNGs at generate time (so changing it marks the set dirty), unlike
// opacity which is applied live. DEFAULT_BLOOM_INDEX reproduces the old glow.
export const DEFAULT_MARKER_BLOOM: Record<CustomizableState, number> = {
  flashCaptured: DEFAULT_BLOOM_INDEX,
  flashUncaptured: DEFAULT_BLOOM_INDEX,
  highlight: DEFAULT_BLOOM_INDEX,
  grey: DEFAULT_BLOOM_INDEX,
  custom: DEFAULT_BLOOM_INDEX,
};

const CUSTOMIZABLE_STATES: CustomizableState[] = ['flashCaptured', 'flashUncaptured', 'highlight', 'grey', 'custom'];

type MarkerCustomizationState = {
  shapeForTier: Record<TierPts, TierPts>;
  colors: MarkerColorPrefs;
  opacity: Record<CustomizableState, number>;
  bloom: Record<CustomizableState, number>;
  /**
   * Opt-in: when true, personal invaders use the `custom` palette instead of
   * the normal flash/rarity/grey ones. Off by default so the map is unchanged
   * for everyone who never touches this. Persisted by regenerate() rather than
   * immediately — the `-custom` sprites have no bundled fallback, so the flag
   * must never be live before a generation has actually written them.
   */
  customColorEnabled: boolean;
  customIconUris: GeneratedMarkerSet | null;
  // Bumped every time customIconUris meaningfully changes (successful
  // regenerate or reset). MapLibre's native Images component only ever
  // registers a given key once and ignores later value updates for it, so
  // WebMap.native.tsx keys <Images> on this to force a full remount —
  // without it, a re-customization would never reach an already-mounted map.
  generationVersion: number;
  isGenerating: boolean;
  isDirty: boolean; // true when shapeForTier/colors/bloom changed since the last successful regenerate()

  setShapeForTier: (tier: TierPts, shapeId: TierPts) => void;
  setColor: (state: keyof MarkerColorPrefs, kind: 'icon' | 'glow', hex: string) => void;
  setOpacity: (state: CustomizableState, v: number) => void;
  setBloom: (state: CustomizableState, index: number) => void;
  setCustomColorEnabled: (v: boolean) => void;
  regenerate: () => Promise<void>;
  reset: () => Promise<void>;
  hydrate: () => Promise<void>;
};

// Runs regenerate()/reset() one-at-a-time. Serializing them (rather than
// letting a later call merely "supersede" an in-flight one) is what guarantees
// a regenerate()'s file writes can never interleave with a reset()'s
// clearMarkerSet() — otherwise a reset landing mid-persist could delete the
// folder the regenerate then points customIconUris/storage at (blank markers).
let opChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = opChain.then(task, task);
  opChain = run.catch(() => {}); // keep the chain alive even if a task rejects
  return run;
}

export const useMarkerCustomizationStore = create<MarkerCustomizationState>((set, get) => ({
  shapeForTier: DEFAULT_SHAPE_FOR_TIER,
  colors: DEFAULT_MARKER_COLORS,
  opacity: DEFAULT_MARKER_OPACITY,
  bloom: DEFAULT_MARKER_BLOOM,
  customColorEnabled: false,
  customIconUris: null,
  generationVersion: 0,
  isGenerating: false,
  isDirty: false,

  setShapeForTier: (tier, shapeId) => {
    set((s) => ({ shapeForTier: { ...s.shapeForTier, [tier]: shapeId }, isDirty: true }));
  },

  // Dirty-marking like shape/colors: it only reaches the map on the next
  // regenerate(), which is also what guarantees the sprites exist by then.
  setCustomColorEnabled: (v) => set({ customColorEnabled: v, isDirty: true }),

  setColor: (state, kind, hex) => {
    set((s) => ({
      colors: { ...s.colors, [state]: { ...s.colors[state], [kind]: hex } },
      isDirty: true,
    }));
  },

  // Opacity is applied live on the map (not baked into the PNGs), so — unlike
  // shape/color — changing it doesn't mark the set dirty or need a regenerate.
  setOpacity: (state, v) => {
    const clamped = Math.max(0, Math.min(1, v));
    const opacity = { ...get().opacity, [state]: clamped };
    set({ opacity });
    AsyncStorage.setItem(OPACITY_KEY, JSON.stringify(opacity)).catch(() => {});
  },

  // Bloom is baked into the PNGs, so — like shape/color — it marks the set dirty
  // and only reaches the map on the next regenerate().
  setBloom: (state, index) => {
    const clamped = Math.max(0, Math.min(BLOOM_LEVEL_COUNT - 1, Math.round(index)));
    set((s) => ({ bloom: { ...s.bloom, [state]: clamped }, isDirty: true }));
  },

  regenerate: () => enqueue(async () => {
    const { shapeForTier, colors, bloom, customColorEnabled } = get();
    set({ isGenerating: true });

    let generated: GenerationResult;
    try {
      generated = await generateMarkerSet(shapeForTier, colors, bloom);
    } catch (err) {
      set({ isGenerating: false });
      throw err;
    }

    try {
      await Promise.all([
        AsyncStorage.setItem(SHAPE_FOR_TIER_KEY, JSON.stringify(shapeForTier)),
        AsyncStorage.setItem(COLORS_KEY, JSON.stringify(colors)),
        AsyncStorage.setItem(BLOOM_KEY, JSON.stringify(bloom)),
        AsyncStorage.setItem(CUSTOM_ENABLED_KEY, JSON.stringify(customColorEnabled)),
        AsyncStorage.setItem(GENERATION_DIR_KEY, generated.dirName),
      ]);
    } catch (err) {
      // Don't pretend success if persistence failed — leave isDirty/customIconUris
      // as they were so the UI doesn't imply a save that won't survive a restart.
      set({ isGenerating: false });
      throw err;
    }

    set((s) => ({ customIconUris: generated.markers, generationVersion: s.generationVersion + 1, isGenerating: false, isDirty: false }));
  }),

  reset: () => enqueue(async () => {
    await clearMarkerSet();
    set((s) => ({
      shapeForTier: DEFAULT_SHAPE_FOR_TIER,
      colors: DEFAULT_MARKER_COLORS,
      opacity: DEFAULT_MARKER_OPACITY,
      bloom: DEFAULT_MARKER_BLOOM,
      customColorEnabled: false,
      customIconUris: null,
      generationVersion: s.generationVersion + 1,
      isGenerating: false,
      isDirty: false,
    }));
    await Promise.all([
      AsyncStorage.removeItem(SHAPE_FOR_TIER_KEY),
      AsyncStorage.removeItem(COLORS_KEY),
      AsyncStorage.removeItem(OPACITY_KEY),
      AsyncStorage.removeItem(BLOOM_KEY),
      AsyncStorage.removeItem(CUSTOM_ENABLED_KEY),
      AsyncStorage.removeItem(GENERATION_DIR_KEY),
    ]);
  }),

  hydrate: async () => {
    // Each key is parsed independently so a single corrupt/legacy entry
    // (e.g. after a schema change) can't silently discard the others.
    let shapeForTierRaw: string | null = null;
    let colorsRaw: string | null = null;
    let opacityRaw: string | null = null;
    let bloomRaw: string | null = null;
    let customEnabledRaw: string | null = null;
    let dirName: string | null = null;
    try {
      [shapeForTierRaw, colorsRaw, opacityRaw, bloomRaw, customEnabledRaw, dirName] = await Promise.all([
        AsyncStorage.getItem(SHAPE_FOR_TIER_KEY),
        AsyncStorage.getItem(COLORS_KEY),
        AsyncStorage.getItem(OPACITY_KEY),
        AsyncStorage.getItem(BLOOM_KEY),
        AsyncStorage.getItem(CUSTOM_ENABLED_KEY),
        AsyncStorage.getItem(GENERATION_DIR_KEY),
      ]);
    } catch {
      return;
    }

    const patch: Partial<MarkerCustomizationState> = {};
    try { if (shapeForTierRaw) patch.shapeForTier = sanitizeShapeForTier(JSON.parse(shapeForTierRaw)); } catch {}
    try { if (colorsRaw) patch.colors = sanitizeColors(JSON.parse(colorsRaw)); } catch {}
    try { if (opacityRaw !== null) patch.opacity = sanitizeOpacity(JSON.parse(opacityRaw)); } catch {}
    try { if (bloomRaw !== null) patch.bloom = sanitizeBloom(JSON.parse(bloomRaw)); } catch {}
    try { if (customEnabledRaw !== null) patch.customColorEnabled = JSON.parse(customEnabledRaw) === true; } catch {}
    // Rebuild the live file:// URIs from the persisted folder name against the
    // current document dir; if the folder is gone (e.g. cleared by the OS),
    // silently fall back to the bundled sprites.
    try {
      if (dirName) {
        const markers = resolveMarkerSet(dirName);
        if (markers) patch.customIconUris = markers;
      }
    } catch {}

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

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function sanitizeOpacity(raw: unknown): Record<CustomizableState, number> {
  // Legacy: opacity used to be a single global number — spread it across all
  // states so an upgrading user keeps roughly the look they had. `custom`
  // postdates that format and never had a legacy value, so it keeps its default.
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const v = clamp01(raw);
    return { flashCaptured: v, flashUncaptured: v, highlight: v, grey: v, custom: DEFAULT_MARKER_OPACITY.custom };
  }
  const out = { ...DEFAULT_MARKER_OPACITY };
  if (raw && typeof raw === 'object') {
    for (const state of CUSTOMIZABLE_STATES) {
      const v = (raw as Record<string, unknown>)[state];
      if (typeof v === 'number' && Number.isFinite(v)) out[state] = clamp01(v);
    }
  }
  return out;
}

function sanitizeBloom(raw: unknown): Record<CustomizableState, number> {
  const out = { ...DEFAULT_MARKER_BLOOM };
  if (raw && typeof raw === 'object') {
    for (const state of CUSTOMIZABLE_STATES) {
      const v = (raw as Record<string, unknown>)[state];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[state] = Math.max(0, Math.min(BLOOM_LEVEL_COUNT - 1, Math.round(v)));
      }
    }
  }
  return out;
}

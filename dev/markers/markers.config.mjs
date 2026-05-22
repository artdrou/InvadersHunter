// Single source of truth for marker shapes, colors, and bloom.
// Edit values here, run `npm run build`, PNGs land in ./out/

export const RARITIES = [10, 20, 30, 40, 50, 100];

// One SVG per rarity — shape is ALWAYS determined by rarity.
// Color mode never changes shape, only color.
export const SHAPE_SVG = {
  10:  'shape-10.svg',
  20:  'shape-20.svg',
  30:  'shape-30.svg',
  40:  'shape-40.svg',
  50:  'shape-50.svg',
  100: 'shape-100.svg',
};

// Color modes:
//   - rarity:  color encodes rarity; flash status shifts the shade.
//   - flash:   color encodes capture status only (same color across all rarities).
//   - grey:    flat grey, overrides everything (dimmed state).
// Palette pulled from the current PNG assets in frontend/assets/images/:
//   10 & 20 pts  → green     (same color, only shape differs)
//   30 & 40 pts  → blue      (same color, only shape differs)
//   50 pts       → magenta
//   100 pts      → yellow/gold
//   flash captured   → cyan (matches cluster color #1cf0ff)
//   flash uncaptured → red-pink (matches cluster color #ff0062)
// Each entry is { icon, bloom }. If `bloom` is null, it is derived from `icon`
// using BLOOM.hueShift/satBoost/lightShift below. Setting it explicitly gives
// the marker a colored accent halo (e.g. cyan icon + Klein-blue glow).
export const COLORS = {
  rarity: {
    10:  { icon: '#1AE34A', bloom: '#0F8C30' },  // green   + deeper-green halo
    20:  { icon: '#1AE34A', bloom: '#0F8C30' },
    30:  { icon: '#2E7BFF', bloom: '#002FA7' },  // blue    + Klein-blue halo
    40:  { icon: '#2E7BFF', bloom: '#002FA7' },
    50:  { icon: '#FF00B0', bloom: '#7A0099' },  // magenta + deep-purple halo
    100: { icon: '#FFC107', bloom: '#FF7A00' },  // gold    + orange halo
  },
  flash: {
    uncaptured: { icon: '#FF0062', bloom: '#A300B3' }, // red-pink + purple-magenta (matches cluster)
    captured:   { icon: '#1CF0FF', bloom: '#002FA7' }, // cyan     + Klein blue       (matches cluster)
  },
  grey: { icon: '#C8C8C8', bloom: '#888888' }, // brighter — pairs with layer-level opacity dimming
};

// Bloom (outer glow). Set enabled:false to skip.
export const BLOOM = {
  enabled: true,
  radius: 8,        // gaussian blur sigma in px — higher = softer / wider glow
  opacity: 0.8,     // 0..1 — higher = more visible glow
  passes: 1,        // stack the glow N times to intensify it without blowing out colors
  spread: 1.6,      // canvas-to-icon ratio (room around icon for glow)

  // Fallback bloom color derivation (used only when a COLORS entry has bloom: null).
  // Prefer setting bloom explicitly in COLORS for predictable per-marker accents.
  hueShift: -0.03,  // -1..1 (fraction of the hue wheel). Negative = warmer, positive = cooler.
  satBoost: 0.25,   // -1..1 added to saturation
  lightShift: 0.0,  // -1..1 added to lightness
};

export const SIZE = 128;

// Auto-trim transparent edges of the rendered icon and rescale so every marker
// occupies the same fraction of the canvas, regardless of how much empty space
// the SVG had around its content.
// ICON_FRACTION = 0.7 means the trimmed icon will fit inside 70% of SIZE,
// leaving 30% padding for the bloom halo.
export const NORMALIZE_ICON_SIZE = true;
export const ICON_FRACTION = 0.7;

// How to apply color to the SVG:
//   - 'shades':        detect all unique fills, map them to shades of the target color (preserves shading)
//   - 'all':           overwrite EVERY hex fill with the target color (flat, no shading)
//   - 'currentColor':  only replace literal `currentColor` (requires editing the SVG by hand)
export const TINT_MODE = 'shades';

// For TINT_MODE='shades': lightness spread around target color in HSL space.
// 0.25 means shades span from L-0.25 to L+0.25 (clamped to 0..1).
// Higher = more contrast between shades; lower = subtler shading.
export const SHADE_SPREAD = 0.25;

// Output filename per (rarity, mode, state).
// These names are what the app's iconKey resolver will produce after wiring.
export function outputName(rarity, mode, state) {
  if (mode === 'grey')   return `marker-${rarity}pts-grey`;
  if (mode === 'rarity') return `marker-${rarity}pts-rarity`;
  return `marker-${rarity}pts-flash-${state}`;
  // examples:
  //   marker-10pts-rarity
  //   marker-10pts-flash-uncaptured
  //   marker-10pts-flash-captured
  //   marker-10pts-grey
}

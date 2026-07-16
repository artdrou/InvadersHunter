// On-device marker rasterizer: takes the user's shape/color/opacity choices
// and produces the same 30 PNG variants (6 point tiers x 5 states) the app
// ships with by default, but generated with Skia instead of the offline
// sharp/Node pipeline in dev/markers/. Mirrors dev/markers/build.mjs's
// buildMarker() (trim + normalize + center + gaussian-blur glow) so the
// visual result matches the bundled assets when nothing is customized.
import { Skia, TileMode, BlendMode, ImageFormat, ColorType, AlphaType, type SkImage, type SkRect } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system';
import { SHAPE_SVG } from './shapes';
import { tintSvg } from './tint';
import { TIER_VALUES, type TierPts, type CustomizableState, type MarkerColorPrefs, type MarkerPalette } from './types';

const SIZE = 128;
const ICON_FRACTION = 0.7;
// Fixed intermediate canvas for rasterizing the source SVG, independent of the
// requested output size. Must be >= the largest shape's intrinsic viewBox
// (shape 100 is 200x200) or that shape gets clipped — which is exactly what
// happened for the small preview/carousel renders (output 72-76 -> old
// intermediate 144-152 < 200). 256 also matches the on-map render (size 128 ->
// 256), so previews now rasterize identically to the map.
const SVG_RASTER = 256;
const TRANSPARENT = '#00000000';

// ── Bloom presets ─────────────────────────────────────────────────────────
// The glow halo is customizable per state as a 3x3 grid of (size x intensity).
// Encoded as a single 0..8 index = size*3 + intensity, matching the stepper on
// the customization screen. Index 4 (medium size + medium intensity) reproduces
// the old fixed BLOOM_RADIUS=8 / BLOOM_OPACITY=0.8 / 1 pass, so default markers
// look unchanged.
const BLOOM_RADII = [5, 8, 12];                    // tiny, medium, large (at SIZE=128)
const BLOOM_INTENSITIES = [                          // weak, medium, strong
  { opacity: 0.5, passes: 1 },
  { opacity: 0.8, passes: 1 },
  { opacity: 1.0, passes: 2 },
];
export const BLOOM_SIZE_COUNT = BLOOM_RADII.length;             // 3 (tiny/medium/large)
export const BLOOM_INTENSITY_COUNT = BLOOM_INTENSITIES.length;  // 3 (weak/medium/strong)
export const BLOOM_LEVEL_COUNT = BLOOM_SIZE_COUNT * BLOOM_INTENSITY_COUNT; // 9
export const DEFAULT_BLOOM_INDEX = 4;               // medium / medium

type Bloom = { radius: number; opacity: number; passes: number };

// Preset index 0..8 = size*3 + intensity.
export function decodeBloom(index: number): { size: number; intensity: number } {
  const i = Math.max(0, Math.min(BLOOM_LEVEL_COUNT - 1, Math.round(index)));
  return { size: Math.floor(i / BLOOM_INTENSITY_COUNT), intensity: i % BLOOM_INTENSITY_COUNT };
}

function bloomFromIndex(index: number): Bloom {
  const { size, intensity } = decodeBloom(index);
  return { radius: BLOOM_RADII[size], ...BLOOM_INTENSITIES[intensity] };
}

// Skia host objects (surfaces, images, SVG DOMs, paints, filters) are backed
// by native memory that is otherwise only reclaimed on GC — which lags well
// behind this tight 30-marker loop and can spike memory / OOM on low-end
// devices. Eagerly free every intermediate the moment we're done with it.
// `dispose` isn't on all the TS types and double-dispose can throw, so guard.
function disposeSkia(obj: unknown): void {
  try {
    (obj as { dispose?: () => void } | null | undefined)?.dispose?.();
  } catch {
    // already disposed / not disposable — nothing to do
  }
}

// Fixed per-tier palette used by "rarity" color mode — not user-customizable
// today (only the silhouette follows the user's shape reassignment).
const RARITY_PALETTE: Record<TierPts, MarkerPalette> = {
  10: { icon: '#1AE34A', glow: '#0F8C30' },
  20: { icon: '#1AE34A', glow: '#0F8C30' },
  30: { icon: '#2E7BFF', glow: '#002FA7' },
  40: { icon: '#2E7BFF', glow: '#002FA7' },
  50: { icon: '#FF00B0', glow: '#7A0099' },
  100: { icon: '#FFC107', glow: '#FF7A00' },
};

function alphaBBox(image: SkImage): { x: number; y: number; width: number; height: number } | null {
  const w = image.width();
  const h = image.height();
  const alpha = image.readPixels(0, 0, { width: w, height: h, colorType: ColorType.Alpha_8, alphaType: AlphaType.Unpremul }) as Uint8Array | null;
  if (!alpha) return null;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (alpha[row + x] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function fitCenteredRect(bbox: { width: number; height: number }, boxPx: number, canvasSize: number): SkRect {
  const scale = Math.min(boxPx / bbox.width, boxPx / bbox.height);
  const w = bbox.width * scale;
  const h = bbox.height * scale;
  return Skia.XYWHRect((canvasSize - w) / 2, (canvasSize - h) / 2, w, h);
}

// tintSvg only ever rewrites `fill` colors — it never touches which pixels are
// opaque — and the SVG is always rasterized at the fixed SVG_RASTER size, so the
// trimmed bounding box is a pure function of shapeId (independent of tint color
// and output size). Caching it means the 5 states sharing a tier's shape only
// pay for one full pixel scan instead of 5.
const bboxCache = new Map<TierPts, { x: number; y: number; width: number; height: number }>();

function shapeBBox(shapeId: TierPts): { x: number; y: number; width: number; height: number } {
  const cached = bboxCache.get(shapeId);
  if (cached) return cached;

  const dom = Skia.SVG.MakeFromString(SHAPE_SVG[shapeId]);
  if (!dom) throw new Error('Failed to parse marker SVG');
  const surface = Skia.Surface.Make(SVG_RASTER, SVG_RASTER);
  if (!surface) { disposeSkia(dom); throw new Error('Failed to allocate Skia surface'); }
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(TRANSPARENT));
  canvas.drawSvg(dom, SVG_RASTER, SVG_RASTER);
  const snapshot = surface.makeImageSnapshot();
  const bbox = alphaBBox(snapshot) ?? { x: 0, y: 0, width: SVG_RASTER, height: SVG_RASTER };
  disposeSkia(snapshot);
  disposeSkia(surface);
  disposeSkia(dom);
  bboxCache.set(shapeId, bbox);
  return bbox;
}

// Rasterize the tinted SVG large, trim transparent padding (using the
// shape's cached bbox), then re-center the trimmed content into a fixed
// fraction of the final canvas — this normalizes visible icon size across
// shapes with different amounts of empty space, matching dev/markers/
// build.mjs's NORMALIZE_ICON_SIZE step.
function rasterizeIcon(shapeId: TierPts, tintedSvg: string, size: number): SkImage {
  const dom = Skia.SVG.MakeFromString(tintedSvg);
  if (!dom) throw new Error('Failed to parse marker SVG');

  const largeSurface = Skia.Surface.Make(SVG_RASTER, SVG_RASTER);
  if (!largeSurface) { disposeSkia(dom); throw new Error('Failed to allocate Skia surface'); }
  const largeCanvas = largeSurface.getCanvas();
  largeCanvas.clear(Skia.Color(TRANSPARENT));
  largeCanvas.drawSvg(dom, SVG_RASTER, SVG_RASTER);
  const largeImage = largeSurface.makeImageSnapshot();

  const bbox = shapeBBox(shapeId);
  const iconBoxPx = size * ICON_FRACTION;
  const dstRect = fitCenteredRect(bbox, iconBoxPx, size);

  const iconSurface = Skia.Surface.Make(size, size);
  if (!iconSurface) {
    disposeSkia(largeImage);
    disposeSkia(largeSurface);
    disposeSkia(dom);
    throw new Error('Failed to allocate Skia surface');
  }
  const iconCanvas = iconSurface.getCanvas();
  iconCanvas.clear(Skia.Color(TRANSPARENT));
  const paint = Skia.Paint();
  iconCanvas.drawImageRect(largeImage, Skia.XYWHRect(bbox.x, bbox.y, bbox.width, bbox.height), dstRect, paint);
  // Raster snapshots keep their own ref to the pixel data, so the returned
  // image stays valid after its source surface is freed.
  const snapshot = iconSurface.makeImageSnapshot();

  disposeSkia(paint);
  disposeSkia(largeImage);
  disposeSkia(largeSurface);
  disposeSkia(iconSurface);
  disposeSkia(dom);
  return snapshot;
}

// Composites the glow halo (blurred, recolored silhouette, drawn under the
// flat icon) — the Skia equivalent of build.mjs's blur+dest-in bloom layer.
// `bloom` controls the halo's radius (size) and opacity/passes (intensity).
function compositeWithGlow(iconImage: SkImage, glowHex: string, size: number, bloom: Bloom): SkImage {
  const surface = Skia.Surface.Make(size, size);
  if (!surface) throw new Error('Failed to allocate Skia surface');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(TRANSPARENT));

  const radius = bloom.radius * (size / SIZE);
  const glowPaint = Skia.Paint();
  const recolor = Skia.ColorFilter.MakeBlend(Skia.Color(glowHex), BlendMode.SrcIn);
  const recolorFilter = Skia.ImageFilter.MakeColorFilter(recolor, null);
  const blurFilter = Skia.ImageFilter.MakeBlur(radius, radius, TileMode.Decal, recolorFilter);
  glowPaint.setImageFilter(blurFilter);
  glowPaint.setAlphaf(bloom.opacity);

  for (let i = 0; i < bloom.passes; i++) canvas.drawImage(iconImage, 0, 0, glowPaint);
  canvas.drawImage(iconImage, 0, 0);
  const snapshot = surface.makeImageSnapshot();

  disposeSkia(blurFilter);
  disposeSkia(recolorFilter);
  disposeSkia(recolor);
  disposeSkia(glowPaint);
  disposeSkia(surface);
  return snapshot;
}

// Renders one marker variant (shape recolored to `iconHex`, optional glow
// halo in `glowHex`) to a base64-encoded PNG. Exported standalone so the
// customization screen's shape thumbnails and live preview can call it
// directly (no file I/O) — `size` defaults to the final on-map asset size and
// `bloomIndex` (0..8) picks the glow size/intensity preset.
export function renderMarkerBase64(shapeId: TierPts, iconHex: string, glowHex: string | null, size: number = SIZE, bloomIndex: number = DEFAULT_BLOOM_INDEX): string {
  const tinted = tintSvg(SHAPE_SVG[shapeId], iconHex);
  const icon = rasterizeIcon(shapeId, tinted, size);
  let final = icon;
  try {
    if (glowHex) final = compositeWithGlow(icon, glowHex, size, bloomFromIndex(bloomIndex));
    const base64 = final.encodeToBase64(ImageFormat.PNG);
    if (!base64) throw new Error('Failed to encode marker PNG');
    return base64;
  } finally {
    if (final !== icon) disposeSkia(final);
    disposeSkia(icon);
  }
}

function outputName(tier: TierPts, state: 'rarity' | CustomizableState): string {
  if (state === 'grey') return `marker-${tier}pts-grey`;
  if (state === 'rarity') return `marker-${tier}pts-rarity`;
  if (state === 'highlight') return `marker-${tier}pts-highlight`;
  return `marker-${tier}pts-flash-${state === 'flashCaptured' ? 'captured' : 'uncaptured'}`;
}

const STATE_KEYS: Array<'rarity' | CustomizableState> = ['rarity', 'flashCaptured', 'flashUncaptured', 'highlight', 'grey'];

// The deterministic set of iconKeys / file basenames a full generation writes.
export const GENERATED_MARKER_NAMES: string[] = TIER_VALUES.flatMap((tier) =>
  STATE_KEYS.map((state) => outputName(tier, state)),
);

function paletteFor(state: 'rarity' | CustomizableState, tier: TierPts, colors: MarkerColorPrefs): MarkerPalette {
  return state === 'rarity' ? RARITY_PALETTE[tier] : colors[state];
}

export type GeneratedMarkerSet = Record<string, string>; // iconKey -> file:// uri
export type GenerationResult = { dirName: string; markers: GeneratedMarkerSet };

const MARKERS_ROOT = new FileSystem.Directory(FileSystem.Paths.document, 'markers');

// Build the absolute file:// URIs for a generation folder from the *current*
// document directory. Callers persist only `dirName` (a relative folder name)
// and rebuild here, because the absolute document-directory path is not stable
// across app updates/reinstalls on iOS — persisting the absolute URIs directly
// would leave them dangling (blank markers) after an update.
export function resolveMarkerSet(dirName: string): GeneratedMarkerSet | null {
  const dir = new FileSystem.Directory(MARKERS_ROOT, dirName);
  if (!dir.exists) return null;
  const markers: GeneratedMarkerSet = {};
  for (const name of GENERATED_MARKER_NAMES) {
    markers[name] = new FileSystem.File(dir, `${name}.png`).uri;
  }
  return markers;
}

// Yields to the JS thread so a long synchronous Skia batch doesn't fully
// freeze the UI (e.g. lets the "generating" spinner actually paint).
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Regenerates all 30 marker PNGs from the user's prefs and writes them to a
// fresh, timestamped subfolder. Older generations are only pruned *after*
// the new one fully succeeds, so a failure partway through (e.g. a Skia
// allocation failure) never leaves the app pointing at deleted files.
export async function generateMarkerSet(
  shapeForTier: Record<TierPts, TierPts>,
  colors: MarkerColorPrefs,
  bloom: Record<CustomizableState, number>,
): Promise<GenerationResult> {
  if (!MARKERS_ROOT.exists) MARKERS_ROOT.create({ intermediates: true });
  const dir = new FileSystem.Directory(MARKERS_ROOT, `v${Date.now()}`);
  dir.create({ intermediates: true });

  try {
    const markers: GeneratedMarkerSet = {};
    for (const tier of TIER_VALUES) {
      const shapeId = shapeForTier[tier] ?? tier;
      for (const state of STATE_KEYS) {
        const { icon, glow } = paletteFor(state, tier, colors);
        // "rarity" isn't user-customizable — keep it at the default bloom.
        const bloomIdx = state === 'rarity' ? DEFAULT_BLOOM_INDEX : bloom[state];
        const base64 = renderMarkerBase64(shapeId, icon, glow, SIZE, bloomIdx);
        const name = outputName(tier, state);
        const file = new FileSystem.File(dir, `${name}.png`);
        file.write(base64, { encoding: 'base64' });
        markers[name] = file.uri;
      }
      await yieldToUi();
    }

    // Success — safe to prune every other generation now. Compared by name
    // (not uri) since directory URIs may differ in trailing-slash formatting.
    for (const entry of MARKERS_ROOT.list()) {
      if (entry.name !== dir.name) entry.delete();
    }
    return { dirName: dir.name, markers };
  } catch (err) {
    dir.delete();
    throw err;
  }
}

export async function clearMarkerSet(): Promise<void> {
  if (MARKERS_ROOT.exists) MARKERS_ROOT.delete();
}

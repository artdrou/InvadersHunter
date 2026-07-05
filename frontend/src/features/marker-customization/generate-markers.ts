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
const BLOOM_RADIUS = 8;
const BLOOM_OPACITY = 0.8;
const BLOOM_PASSES = 1;
const TRANSPARENT = '#00000000';

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

// tintSvg only ever rewrites `fill` colors — it never touches which pixels
// are opaque — so the trimmed bounding box is a pure function of (shapeId,
// size), independent of the tint color. Caching it here means the 5 states
// sharing a tier's shape only pay for one full pixel scan instead of 5.
const bboxCache = new Map<string, { x: number; y: number; width: number; height: number }>();

function shapeBBox(shapeId: TierPts, size: number): { x: number; y: number; width: number; height: number } {
  const cacheKey = `${shapeId}:${size}`;
  const cached = bboxCache.get(cacheKey);
  if (cached) return cached;

  const largeSize = size * 2;
  const dom = Skia.SVG.MakeFromString(SHAPE_SVG[shapeId]);
  if (!dom) throw new Error('Failed to parse marker SVG');
  const surface = Skia.Surface.Make(largeSize, largeSize);
  if (!surface) throw new Error('Failed to allocate Skia surface');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(TRANSPARENT));
  canvas.drawSvg(dom, largeSize, largeSize);
  const bbox = alphaBBox(surface.makeImageSnapshot()) ?? { x: 0, y: 0, width: largeSize, height: largeSize };
  bboxCache.set(cacheKey, bbox);
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

  const largeSize = size * 2;
  const largeSurface = Skia.Surface.Make(largeSize, largeSize);
  if (!largeSurface) throw new Error('Failed to allocate Skia surface');
  const largeCanvas = largeSurface.getCanvas();
  largeCanvas.clear(Skia.Color(TRANSPARENT));
  largeCanvas.drawSvg(dom, largeSize, largeSize);
  const largeImage = largeSurface.makeImageSnapshot();

  const bbox = shapeBBox(shapeId, size);
  const iconBoxPx = size * ICON_FRACTION;
  const dstRect = fitCenteredRect(bbox, iconBoxPx, size);

  const iconSurface = Skia.Surface.Make(size, size);
  if (!iconSurface) throw new Error('Failed to allocate Skia surface');
  const iconCanvas = iconSurface.getCanvas();
  iconCanvas.clear(Skia.Color(TRANSPARENT));
  iconCanvas.drawImageRect(largeImage, Skia.XYWHRect(bbox.x, bbox.y, bbox.width, bbox.height), dstRect, Skia.Paint());
  return iconSurface.makeImageSnapshot();
}

// Composites the glow halo (blurred, recolored silhouette, drawn under the
// flat icon) — the Skia equivalent of build.mjs's blur+dest-in bloom layer.
function compositeWithGlow(iconImage: SkImage, glowHex: string, size: number): SkImage {
  const surface = Skia.Surface.Make(size, size);
  if (!surface) throw new Error('Failed to allocate Skia surface');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(TRANSPARENT));

  const radius = BLOOM_RADIUS * (size / SIZE);
  const glowPaint = Skia.Paint();
  const recolor = Skia.ColorFilter.MakeBlend(Skia.Color(glowHex), BlendMode.SrcIn);
  glowPaint.setImageFilter(Skia.ImageFilter.MakeBlur(radius, radius, TileMode.Decal, Skia.ImageFilter.MakeColorFilter(recolor, null)));
  glowPaint.setAlphaf(BLOOM_OPACITY);

  for (let i = 0; i < BLOOM_PASSES; i++) canvas.drawImage(iconImage, 0, 0, glowPaint);
  canvas.drawImage(iconImage, 0, 0);
  return surface.makeImageSnapshot();
}

// Renders one marker variant (shape recolored to `iconHex`, optional glow
// halo in `glowHex`) to a base64-encoded PNG. Exported standalone so the
// customization screen's shape thumbnails and live preview can call it
// directly (no file I/O) — `size` defaults to the final on-map asset size.
export function renderMarkerBase64(shapeId: TierPts, iconHex: string, glowHex: string | null, size: number = SIZE): string {
  const tinted = tintSvg(SHAPE_SVG[shapeId], iconHex);
  const icon = rasterizeIcon(shapeId, tinted, size);
  const final = glowHex ? compositeWithGlow(icon, glowHex, size) : icon;
  const base64 = final.encodeToBase64(ImageFormat.PNG);
  if (!base64) throw new Error('Failed to encode marker PNG');
  return base64;
}

function outputName(tier: TierPts, state: 'rarity' | CustomizableState): string {
  if (state === 'grey') return `marker-${tier}pts-grey`;
  if (state === 'rarity') return `marker-${tier}pts-rarity`;
  if (state === 'highlight') return `marker-${tier}pts-highlight`;
  return `marker-${tier}pts-flash-${state === 'flashCaptured' ? 'captured' : 'uncaptured'}`;
}

const STATE_KEYS: Array<'rarity' | CustomizableState> = ['rarity', 'flashCaptured', 'flashUncaptured', 'highlight', 'grey'];

function paletteFor(state: 'rarity' | CustomizableState, tier: TierPts, colors: MarkerColorPrefs): MarkerPalette {
  return state === 'rarity' ? RARITY_PALETTE[tier] : colors[state];
}

export type GeneratedMarkerSet = Record<string, string>; // iconKey -> file:// uri

const MARKERS_ROOT = new FileSystem.Directory(FileSystem.Paths.document, 'markers');

// Yields to the JS thread so a long synchronous Skia batch doesn't fully
// freeze the UI (e.g. lets the "generating" spinner actually paint).
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Regenerates all 30 marker PNGs from the user's prefs and writes them to a
// fresh, timestamped subfolder. Older generations are only pruned *after*
// the new one fully succeeds, so a failure partway through (e.g. a Skia
// allocation failure) never leaves the app pointing at deleted files.
export async function generateMarkerSet(shapeForTier: Record<TierPts, TierPts>, colors: MarkerColorPrefs): Promise<GeneratedMarkerSet> {
  if (!MARKERS_ROOT.exists) MARKERS_ROOT.create({ intermediates: true });
  const dir = new FileSystem.Directory(MARKERS_ROOT, `v${Date.now()}`);
  dir.create({ intermediates: true });

  try {
    const result: GeneratedMarkerSet = {};
    for (const tier of TIER_VALUES) {
      const shapeId = shapeForTier[tier] ?? tier;
      for (const state of STATE_KEYS) {
        const { icon, glow } = paletteFor(state, tier, colors);
        const base64 = renderMarkerBase64(shapeId, icon, glow);
        const name = outputName(tier, state);
        const file = new FileSystem.File(dir, `${name}.png`);
        file.write(base64, { encoding: 'base64' });
        result[name] = file.uri;
      }
      await yieldToUi();
    }

    // Success — safe to prune every other generation now. Compared by name
    // (not uri) since directory URIs may differ in trailing-slash formatting.
    for (const entry of MARKERS_ROOT.list()) {
      if (entry.name !== dir.name) entry.delete();
    }
    return result;
  } catch (err) {
    dir.delete();
    throw err;
  }
}

export async function clearMarkerSet(): Promise<void> {
  if (MARKERS_ROOT.exists) MARKERS_ROOT.delete();
}

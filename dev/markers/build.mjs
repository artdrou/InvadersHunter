// Build script: SVG shapes + config -> bloomed PNG markers.
// Usage (from dev/markers/):  npm install  &&  npm run build

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  RARITIES, SHAPE_SVG, COLORS, BLOOM, SIZE, TINT_MODE, SHADE_SPREAD,
  NORMALIZE_ICON_SIZE, ICON_FRACTION, outputName,
} from './markers.config.mjs';

// ---- color utils ---------------------------------------------------------

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6); // drop alpha
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const to = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

// Relative luminance approximation — good enough for ranking shades.
function luminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Derive the bloom color from the icon color: hue shift + saturation boost + lightness adjust.
function deriveBloomColor(iconHex) {
  const hsl = rgbToHsl(hexToRgb(iconHex));
  const h = (hsl.h + (BLOOM.hueShift ?? 0) + 1) % 1; // wrap around the wheel
  const s = Math.max(0, Math.min(1, hsl.s + (BLOOM.satBoost ?? 0)));
  const l = Math.max(0, Math.min(1, hsl.l + (BLOOM.lightShift ?? 0)));
  return rgbToHex(hslToRgb({ h, s, l }));
}

// Extract all unique hex fills found in the SVG markup (excludes "none" / currentColor).
function extractUniqueFills(svg) {
  const re = /(?:fill="|fill:\s*)(#[0-9a-fA-F]{3,8})/g;
  const seen = new Set();
  let m;
  while ((m = re.exec(svg)) !== null) seen.add(m[1].toLowerCase());
  return [...seen];
}

// Given N unique source colors and a target color, return a Map<sourceHex, shadeHex>.
// Source colors are ranked dark->light; shades are spread around the target's HSL.l.
function buildShadeMap(uniqueSources, targetHex) {
  if (uniqueSources.length === 0) return new Map();

  const target = rgbToHsl(hexToRgb(targetHex));

  // Rank sources by luminance, dark -> light.
  const ranked = [...uniqueSources].sort(
    (a, b) => luminance(hexToRgb(a)) - luminance(hexToRgb(b)),
  );

  const n = ranked.length;
  const map = new Map();

  for (let i = 0; i < n; i++) {
    // t in [-1, +1] mapping rank to a position around the target lightness
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const l = Math.max(0, Math.min(1, target.l + t * SHADE_SPREAD));
    const shade = rgbToHex(hslToRgb({ h: target.h, s: target.s, l }));
    map.set(ranked[i], shade);
  }
  return map;
}
// -------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, 'src');
const OUT_DIR = join(HERE, 'out');

function tintSvg(svg, hex) {
  if (TINT_MODE === 'currentColor') {
    return svg.replaceAll('currentColor', hex);
  }

  if (TINT_MODE === 'all') {
    return svg
      .replaceAll('currentColor', hex)
      .replace(/fill="#[0-9a-fA-F]{3,8}"/g, `fill="${hex}"`)
      .replace(/fill:\s*#[0-9a-fA-F]{3,8}/g, `fill:${hex}`);
  }

  // TINT_MODE === 'shades': preserve shading by mapping each unique source fill
  // to a shade of the target color, ranked by luminance.
  const sources = extractUniqueFills(svg);
  const shadeMap = buildShadeMap(sources, hex);

  let out = svg.replaceAll('currentColor', hex);
  for (const [src, shade] of shadeMap) {
    // Replace both fill="..." and style="fill:..." forms, case-insensitively.
    const srcEsc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`fill="${srcEsc}"`, 'gi'), `fill="${shade}"`)
      .replace(new RegExp(`fill:\\s*${srcEsc}`, 'gi'), `fill:${shade}`);
  }
  return out;
}

async function rasterize(svg, px) {
  return sharp(Buffer.from(svg), { density: 384 })
    .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function buildMarker(svgRaw, palette) {
  // Accept either a string (icon color, bloom auto-derived) or { icon, bloom }.
  const iconColor  = typeof palette === 'string' ? palette : palette.icon;
  const bloomColor = typeof palette === 'string' ? null    : palette.bloom;

  const tinted = tintSvg(svgRaw, iconColor);

  // Target box for the icon content (excluding bloom padding).
  const iconBoxPx = NORMALIZE_ICON_SIZE
    ? Math.round(SIZE * ICON_FRACTION)
    : Math.round(SIZE / BLOOM.spread);

  // Rasterize the SVG large, then optionally trim transparent borders and
  // resize the trimmed content into the icon box. This normalizes the visible
  // size across SVGs with different amounts of empty padding.
  let iconImg = sharp(Buffer.from(tinted), { density: 384 })
    .resize(SIZE * 2, SIZE * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

  if (NORMALIZE_ICON_SIZE) {
    iconImg = sharp(await iconImg.png().toBuffer())
      .trim() // crop transparent edges down to actual content
      .resize(iconBoxPx, iconBoxPx, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  } else {
    iconImg = iconImg.resize(iconBoxPx, iconBoxPx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }

  const iconBuf = await iconImg.png().toBuffer();

  const centered = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toBuffer();

  if (!BLOOM.enabled) return centered;

  // 1. Blur the icon → gives us a shape mask in the icon's own colors.
  const blurred = await sharp(centered).blur(BLOOM.radius).png().toBuffer();

  // 2. Recolor that blurred shape with the derived bloom color:
  //    - start from a fully-opaque solid bloom-color canvas
  //    - dest-in with the blurred icon → keeps only pixels where the blurred shape has alpha,
  //      preserving its alpha falloff but replacing the RGB with the bloom color.
  const bloomHex = bloomColor ?? deriveBloomColor(iconColor);
  const { r, g, b } = hexToRgb(bloomHex);

  const glow = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .composite([
      { input: blurred, blend: 'dest-in' },
      // Apply global opacity multiplier on the recolored glow.
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
             <rect width="100%" height="100%" fill="white" fill-opacity="${BLOOM.opacity}"/>
           </svg>`
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  const glowLayers = Array.from({ length: BLOOM.passes ?? 1 }, () => ({ input: glow }));

  return sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([...glowLayers, { input: centered }])
    .png()
    .toBuffer();
}

async function loadShape(filename) {
  return readFile(join(SRC_DIR, filename), 'utf8');
}

async function emit(name, buffer) {
  await writeFile(join(OUT_DIR, `${name}.png`), buffer);
  console.log('  •', `${name}.png`);
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Building ${RARITIES.length * 4} marker variants...\n`);

  for (const rarity of RARITIES) {
    const svg = await loadShape(SHAPE_SVG[rarity]);

    await emit(outputName(rarity, 'rarity', null),
      await buildMarker(svg, COLORS.rarity[rarity]));

    await emit(outputName(rarity, 'flash', 'uncaptured'),
      await buildMarker(svg, COLORS.flash.uncaptured));

    await emit(outputName(rarity, 'flash', 'captured'),
      await buildMarker(svg, COLORS.flash.captured));

    await emit(outputName(rarity, 'grey', null),
      await buildMarker(svg, COLORS.grey));
  // (loop body uses each rarity's palette object; bloom color comes from the config)
  }

  console.log(`\nDone. Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

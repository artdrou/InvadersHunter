// Color math ported from dev/markers/build.mjs (TINT_MODE='shades' only).
// Pure string/number utilities — no Node dependency — so they run on-device.

const SHADE_SPREAD = 0.25;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
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

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
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

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function extractUniqueFills(svg: string): string[] {
  const re = /(?:fill="|fill:\s*)(#[0-9a-fA-F]{3,8})/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) seen.add(m[1].toLowerCase());
  return [...seen];
}

function buildShadeMap(uniqueSources: string[], targetHex: string): Map<string, string> {
  if (uniqueSources.length === 0) return new Map();

  const target = rgbToHsl(hexToRgb(targetHex));
  const ranked = [...uniqueSources].sort(
    (a, b) => luminance(hexToRgb(a)) - luminance(hexToRgb(b)),
  );

  const n = ranked.length;
  const map = new Map<string, string>();
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const l = Math.max(0, Math.min(1, target.l + t * SHADE_SPREAD));
    const shade = rgbToHex(hslToRgb({ h: target.h, s: target.s, l }));
    map.set(ranked[i], shade);
  }
  return map;
}

// Body and shade greys of the pixel-art sources (dev/markers/normalize_avatars.py palette)
const BODY_LIGHTNESS = rgbToHsl(hexToRgb('#808080')).l;
const SHADE_LIGHTNESS = rgbToHsl(hexToRgb('#4f4f4f')).l;
// Where the marker shapes put their shading once colored (4-tone 50 / 100 pts): the
// outline 2/3 of the spread below the body
const SHADE_OFFSET = -(2 / 3) * SHADE_SPREAD;

// Lightness offset from the body for an anchored source grey: black → -SPREAD (eyes,
// as the 30 pts), #4f4f4f → SHADE_OFFSET (outline, as 50 / 100 pts), white → +SPREAD
// (eye whites, as the 30 pts); greys in between are interpolated.
function anchoredOffset(l: number): number {
  if (l >= BODY_LIGHTNESS) return ((l - BODY_LIGHTNESS) / (1 - BODY_LIGHTNESS)) * SHADE_SPREAD;
  if (l >= SHADE_LIGHTNESS) return ((BODY_LIGHTNESS - l) / (BODY_LIGHTNESS - SHADE_LIGHTNESS)) * SHADE_OFFSET;
  return SHADE_OFFSET - ((SHADE_LIGHTNESS - l) / SHADE_LIGHTNESS) * (SHADE_SPREAD + SHADE_OFFSET);
}

// Anchored variant: the body grey becomes exactly the target color, so a 2-tone
// shape's body matches a single-color one instead of being pushed lighter. The other
// greys get the same contrast as on the marker shapes (anchoredOffset).
function buildAnchoredShadeMap(uniqueSources: string[], targetHex: string): Map<string, string> {
  const target = rgbToHsl(hexToRgb(targetHex));
  const map = new Map<string, string>();
  for (const src of uniqueSources) {
    const l = Math.max(0, Math.min(1, target.l + anchoredOffset(rgbToHsl(hexToRgb(src)).l)));
    map.set(src, rgbToHex(hslToRgb({ h: target.h, s: target.s, l })));
  }
  return map;
}

// Recolors a pixel-art SVG by mapping each unique source fill to a shade of
// the target color, ranked by luminance (preserves the shape's shading).
// `anchored` = body grey → exactly the target color (profile icon shapes).
export function tintSvg(svg: string, hex: string, anchored = false): string {
  const sources = extractUniqueFills(svg);
  const shadeMap = anchored ? buildAnchoredShadeMap(sources, hex) : buildShadeMap(sources, hex);

  let out = svg;
  for (const [src, shade] of shadeMap) {
    const srcEsc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`fill="${srcEsc}"`, 'gi'), `fill="${shade}"`)
      .replace(new RegExp(`fill:\\s*${srcEsc}`, 'gi'), `fill:${shade}`);
  }
  return out;
}

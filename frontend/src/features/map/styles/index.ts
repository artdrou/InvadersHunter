import { MAP_STYLE_URLS } from '@/constants/config';
import { MAP_PALETTES } from './palettes';
import { buildMapStyle } from './build-style';

export { MAP_PALETTES, blueMapPalette, type MapPalette } from './palettes';
export { buildMapStyle } from './build-style';

// Recolored styles are built once per theme, then reused.
const styleCache = new Map<string, object>();

export type ResolveOptions = {
  /** Show POI labels (local themes only). Default true. */
  showPoi?: boolean;
  /** Use the lean layer set for low-end devices (local themes only). Default false. */
  lite?: boolean;
};

/**
 * Resolve a theme name to a MapLibre style.
 * A theme with a palette in MAP_PALETTES gets a local, keyless recolored style
 * (Liberty base — see build-style.ts); `showPoi` / `lite` tune its layers and
 * only apply to those local themes. Any other theme uses a hosted URL
 * (dark / light); unknown names fall back to dark.
 */
export function resolveMapStyle(themeName: string, options: ResolveOptions = {}): string | object {
  const palette = MAP_PALETTES[themeName];
  if (palette) {
    const { showPoi = true, lite = false } = options;
    const key = `${themeName}:poi=${showPoi ? 1 : 0}:lite=${lite ? 1 : 0}`;
    let style = styleCache.get(key);
    if (!style) {
      style = buildMapStyle(palette, { showPoi, lite });
      styleCache.set(key, style);
    }
    return style;
  }
  return MAP_STYLE_URLS[themeName] ?? MAP_STYLE_URLS.dark;
}

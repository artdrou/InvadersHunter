import { MAP_STYLE_URLS } from '@/constants/config';
import { MAP_PALETTES } from './palettes';
import { buildMapStyle } from './build-style';

export { MAP_PALETTES, blueMapPalette, type MapPalette } from './palettes';
export { buildMapStyle } from './build-style';

// Recolored styles are built once per theme, then reused.
const styleCache = new Map<string, object>();

/**
 * Resolve a theme name to a MapLibre style.
 * A theme with a palette in MAP_PALETTES gets a local, keyless recolored style
 * (Liberty base — see build-style.ts). Any other theme uses a hosted URL
 * (dark / light); unknown names fall back to dark.
 */
export function resolveMapStyle(themeName: string): string | object {
  const palette = MAP_PALETTES[themeName];
  if (palette) {
    let style = styleCache.get(themeName);
    if (!style) {
      style = buildMapStyle(palette);
      styleCache.set(themeName, style);
    }
    return style;
  }
  return MAP_STYLE_URLS[themeName] ?? MAP_STYLE_URLS.dark;
}

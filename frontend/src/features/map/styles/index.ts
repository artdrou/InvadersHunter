import { MAP_STYLE_URLS } from '@/constants/config';
import { BLUE_MAP_STYLE } from './build-style';

export { MAP_PALETTE, type MapPalette } from './palette';
export { BLUE_MAP_STYLE, buildMapStyle } from './build-style';

/**
 * Resolve a theme name to a MapLibre style.
 * `dark` / `light` are hosted OpenFreeMap URLs; `blue` is a local, keyless style
 * object (Liberty recolored from the palette — see build-style.ts / palette.ts).
 */
export function resolveMapStyle(themeName: string): string | object {
  if (themeName === 'blue') return BLUE_MAP_STYLE;
  return MAP_STYLE_URLS[themeName] ?? MAP_STYLE_URLS.dark;
}

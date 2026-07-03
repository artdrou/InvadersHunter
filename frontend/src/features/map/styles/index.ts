import { MAP_THEMES, darkMapPalette } from './palettes';
import { buildMapStyle } from './build-style';

export { MAP_THEMES, darkMapPalette, lightMapPalette, type MapPalette } from './palettes';
export { buildMapStyle } from './build-style';

export type ResolveOptions = {
  /** Show POI labels. Default true. */
  showPoi?: boolean;
  /** Use the lean layer set for low-end devices. Default false. */
  lite?: boolean;
  /** Show 3D building extrusions (heavier; ignored in Lite). Default false. */
  show3d?: boolean;
};

// Built styles are cached per theme + option combination, then reused.
const styleCache = new Map<string, object>();

/**
 * Resolve a theme name to a MapLibre style object. Every theme is built from the
 * local Liberty base (see build-style.ts): its MAP_THEMES palette recolors it, or
 * null keeps Liberty's own light colors. `showPoi` / `lite` tune the layers.
 * Unknown names fall back to the dark palette.
 */
export function resolveMapStyle(themeName: string, options: ResolveOptions = {}): object {
  const palette = themeName in MAP_THEMES ? MAP_THEMES[themeName] : darkMapPalette;
  const { showPoi = true, lite = false, show3d = false } = options;
  const key = `${themeName}:poi=${showPoi ? 1 : 0}:lite=${lite ? 1 : 0}:3d=${show3d ? 1 : 0}`;
  let style = styleCache.get(key);
  if (!style) {
    style = buildMapStyle(palette, { showPoi, lite, show3d });
    styleCache.set(key, style);
  }
  return style;
}

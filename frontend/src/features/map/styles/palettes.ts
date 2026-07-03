/**
 * Map color palettes — the color system for locally-built map themes.
 *
 * Each themed map is the OpenFreeMap **Liberty** base style (liberty-base.json —
 * the same vector tiles, POIs and labels the light theme uses) recolored, one
 * layer-group at a time, from a `MapPalette`. See build-style.ts for exactly
 * which map layers each field controls.
 *
 * To add a new map theme (e.g. "red"):
 *   1. add a `redMapPalette` below (copy one and retune the colors),
 *   2. register it in `MAP_PALETTES` under the theme's name,
 *   3. make sure that name exists as a `ThemeName` in constants/theme.ts.
 * `resolveMapStyle()` then builds and caches its style automatically — no other
 * wiring needed. Themes without a palette here fall back to a hosted URL
 * (see MAP_STYLE_URLS in constants/config.ts), as `dark` and `light` do.
 */
export type MapPalette = {
  /** Map base / empty land behind everything. */
  background: string;
  /** Seas, lakes, rivers, canals. */
  water: string;
  /** River / lake name labels. */
  waterLabel: string;
  /** Parks, woods, grass. */
  greenery: string;
  /** Residential / institutional land patches (schools, hospitals, cemeteries…). */
  landuse: string;
  /** Road surface (all classes: motorway → minor). */
  road: string;
  /** Thin outline drawn around roads. */
  roadCasing: string;
  /** Railway lines. */
  rail: string;
  /** Building fill. */
  building: string;
  /** Building edge/outline. */
  buildingOutline: string;
  /** Administrative borders (country / region). */
  boundary: string;
  /** Place & street label text. */
  label: string;
  /** Outline drawn behind label text so it stays readable over any color. */
  labelHalo: string;
  /** Point-of-interest label text (shops, stations, etc.). */
  poi: string;
};

/** Dark-navy palette for the blue theme (matches blueTheme in constants/theme.ts). */
export const blueMapPalette: MapPalette = {
  background:      '#0b1120',
  water:           '#103050',
  waterLabel:      '#5fa8d8',
  greenery:        '#14352b',
  landuse:         '#0e1a2e',
  road:            '#34527d',
  roadCasing:      '#1b2f4d',
  rail:            '#3b4a63',
  building:        '#111d33',
  buildingOutline: '#233b5c',
  boundary:        '#41618f',
  label:           '#cdd9f0',
  labelHalo:       '#0a0f1e',
  poi:             '#8fa6cc',
};

/**
 * Map palettes keyed by app theme name. A theme listed here gets a local,
 * keyless recolored style; anything else uses a hosted URL (dark / light).
 */
export const MAP_PALETTES: Record<string, MapPalette> = {
  blue: blueMapPalette,
};

/**
 * Map color palettes — the color system for locally-built map themes.
 *
 * Every map theme is the OpenFreeMap **Liberty** base style (liberty-base.json —
 * one bundled set of vector tiles, POIs and labels) recolored from a `MapPalette`,
 * one layer-group at a time, and supports the POI / Lite layer toggles. See
 * build-style.ts for what each palette field controls and what Lite trims.
 *
 * To add a new map theme (e.g. "red"):
 *   1. add a `redMapPalette` below (copy one and retune the colors),
 *   2. register it in `MAP_THEMES` under the theme's name,
 *   3. make sure that name exists as a `ThemeName` in constants/theme.ts.
 * `resolveMapStyle()` then builds and caches its style automatically.
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

/** Dark-navy palette for the dark theme (matches darkTheme in constants/theme.ts). */
export const darkMapPalette: MapPalette = {
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
 * Light palette — Liberty's own light colors, lifted into the palette system so
 * the light theme is customizable too. Flattened by design (one color per group,
 * e.g. all roads share `road`), so it reads close to Liberty rather than pixel-identical.
 */
export const lightMapPalette: MapPalette = {
  background:      '#f8f4f0',
  water:           '#a0c8f0',
  waterLabel:      '#4a6a9a',
  greenery:        '#d6e8c4',
  landuse:         '#ece3d5',
  road:            '#ffffff',
  roadCasing:      '#d4cdbf',
  rail:            '#c0c0c0',
  building:        '#e2ded7',
  buildingOutline: '#d0c9bd',
  boundary:        '#9aa0aa',
  label:           '#333333',
  labelHalo:       '#ffffff',
  poi:             '#666666',
};

/**
 * Map palettes keyed by app theme name. Each recolors the Liberty base into a
 * local, keyless style and supports the POI / Lite toggles.
 */
export const MAP_THEMES: Record<string, MapPalette> = {
  dark: darkMapPalette,
  light: lightMapPalette,
};

/**
 * Map color palette for the "blue" theme.
 *
 * The blue map is the OpenFreeMap **Liberty** base style (see liberty-base.json —
 * the same vector tiles, POIs and labels the light theme uses) recolored, one
 * layer-group at a time, from the values below. This is the single file to edit:
 * change any color, reload the app, and every matching map layer updates. See
 * build-style.ts for exactly which map layers each group controls.
 *
 * Defaults are tuned to sit under the dark-navy UI theme (blueTheme in
 * constants/theme.ts: bg #0a0f1e, cyan accent).
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

export const MAP_PALETTE: MapPalette = {
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

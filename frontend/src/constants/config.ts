// Central registry of external service endpoints and their keys.
// Environment-specific values come from EXPO_PUBLIC_* vars (see .env.example);
// no secret is hardcoded here.

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

/** MapLibre style URLs keyed by theme name. The `blue` style needs a MapTiler key. */
export const MAP_STYLE_URLS: Record<string, string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/liberty',
  blue: `https://api.maptiler.com/maps/019d4e3d-65da-75e0-8ed5-e0c944618e3a/style.json?key=${MAPTILER_KEY}`,
};

/** OpenRouteService (directions / distance matrix). */
export const ORS_BASE_URL = 'https://api.openrouteservice.org';
export const ORS_KEY = process.env.EXPO_PUBLIC_ORS_KEY ?? '';

/** Nominatim geocoding endpoint (address search). */
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

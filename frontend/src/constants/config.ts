// Central registry of external service endpoints and their keys.
// Environment-specific values come from EXPO_PUBLIC_* vars (see .env.example);
// no secret is hardcoded here.
//
// Map styles are built locally from a bundled OpenFreeMap Liberty base — see
// features/map/styles (resolveMapStyle / MAP_THEMES). No hosted style URLs.

/** OpenRouteService (directions / distance matrix). */
export const ORS_BASE_URL = 'https://api.openrouteservice.org';
export const ORS_KEY = process.env.EXPO_PUBLIC_ORS_KEY ?? '';

/** Nominatim geocoding endpoint (address search). */
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/** Deep link to Google Maps walking/driving directions toward a coordinate. */
export const GOOGLE_MAPS_DIR_URL = (lat: number | null, lon: number | null): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

/** Instagram hashtag page for an invader (its name, lowercased). */
export const INSTAGRAM_TAG_URL = (name: string): string =>
  `https://www.instagram.com/explore/tags/${name.toLowerCase()}/`;

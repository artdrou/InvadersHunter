// Map camera & animation constants. Kept out of components so zoom/timing
// choices live in one place (see CONVENTIONS.md — no magic numbers in components).

/** Fallback map center when the user's location isn't known yet (Paris, Île de la Cité). */
export const DEFAULT_CENTER: [number, number] = [2.3522, 48.8566];

/** Camera zoom levels. */
export const MapZoom = {
  initial: 12,               // first paint — city overview
  user: 15,                  // "locate me" framing
  detail: 17,                // focus a single invader (deep-link, long-press, pick)
  clusterExpandFallback: 14, // used when a cluster has no expansion_zoom hint
  hunt: 18,                  // hunt view: street level
} as const;

/** Camera animation durations (ms). */
export const MapAnim = {
  none: 0,
  follow: 300,          // follow-mode camera step
  recenter: 350,        // centerOn / centerOnUser / resetNorth
  clusterExpand: 400,
  releaseDelay: 450,    // delay before releasing the camera (setCamera({}))
  initialReleaseDelay: 100,
  hunt: 250,            // hunt-view camera step (a bit longer than the interval: steps blend)
  huntEnter: 900,       // swoop from the flat map into the hunt view
} as const;

/** Follow-mode: how often to re-center on the user (ms). */
export const FOLLOW_INTERVAL_MS = 300;

/** Multiplier applied to a popup's half-height as top padding when centering on it. */
export const CENTER_PADDING_FACTOR = 2.25;

/** Hunt view: how often the camera steps toward the user (ms). */
export const HUNT_INTERVAL_MS = 200;

/** Hunt view: camera tilt (degrees, 0 = flat). 60 is MapLibre Native's maximum. */
export const HUNT_PITCH = 60;

/** Hunt view: share of the map height left above the user, so the dot sits in the lower third. */
export const HUNT_TOP_PADDING_RATIO = 0.45;

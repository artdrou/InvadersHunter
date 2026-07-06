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
} as const;

/** Camera animation durations (ms). */
export const MapAnim = {
  none: 0,
  follow: 300,          // follow-mode camera step
  recenter: 350,        // centerOn / centerOnUser / resetNorth
  clusterExpand: 400,
  releaseDelay: 450,    // delay before releasing the camera (setCamera({}))
  initialReleaseDelay: 100,
} as const;

/** Follow-mode: how often to re-center on the user (ms). */
export const FOLLOW_INTERVAL_MS = 300;

/** Multiplier applied to a popup's half-height as top padding when centering on it. */
export const CENTER_PADDING_FACTOR = 2.25;

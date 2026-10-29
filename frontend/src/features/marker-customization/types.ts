import type { ExtraShapeId } from './extra-shapes';

export type TierPts = 10 | 20 | 30 | 40 | 50 | 100;

/** Any silhouette of the pool: a tier's own shape, or an extra one ("big-3"…). */
export type ShapeId = TierPts | ExtraShapeId;

export const TIER_VALUES: TierPts[] = [10, 20, 30, 40, 50, 100];

// The 4 marker states the user can recolor (icon + glow). "rarity" mode has its
// own per-tier palette (RarityColorPrefs), also editable.
export type CustomizableState = 'flashCaptured' | 'flashUncaptured' | 'highlight' | 'grey';

export type MarkerPalette = {
  icon: string;
  glow: string;
};

export type MarkerColorPrefs = Record<CustomizableState, MarkerPalette>;

export type RarityColorPrefs = Record<TierPts, MarkerPalette>;

// Invader states that can replace their points' silhouette (Destroyed → ghost by
// default). null = keep the points' shape. Colors still follow the color mode.
export type StateGroup = 'destroyed' | 'notVisible';

export const STATE_GROUPS: StateGroup[] = ['destroyed', 'notVisible'];

export type ShapeForState = Record<StateGroup, ShapeId | null>;

/** iconKey suffix of a state group's markers: `marker-30pts-grey-destroyed`. */
export const STATE_GROUP_SUFFIX: Record<StateGroup, string> = {
  destroyed: 'destroyed',
  notVisible: 'not-visible',
};

// "State" color mode: one palette per invader condition. Damaged = the 3 degraded
// levels; reactivated = back to Good after Destroyed / Not visible, during
// REACTIVATED_DAYS (features/reactivations).
export type StateColorKey = 'good' | 'damaged' | 'destroyed' | 'notVisible' | 'reactivated';

export const STATE_COLOR_KEYS: StateColorKey[] = ['good', 'damaged', 'reactivated', 'destroyed', 'notVisible'];

export type StateColorPrefs = Record<StateColorKey, MarkerPalette>;

export const STATE_COLOR_DISPLAY = {
  good: 'state-good',
  damaged: 'state-damaged',
  destroyed: 'state-destroyed',
  notVisible: 'state-not-visible',
  reactivated: 'state-reactivated',
} as const satisfies Record<StateColorKey, string>;

// Every marker look of one tier, as used in iconKeys: `marker-30pts-${display}`.
export const MARKER_DISPLAYS = [
  'rarity', 'flash-captured', 'flash-uncaptured', 'flash-mine', 'flash-friend', 'highlight', 'grey',
  'state-good', 'state-damaged', 'state-reactivated', 'state-destroyed', 'state-not-visible',
] as const;

// State silhouettes (the ghost…) are drawn a bit smaller than the points' shapes:
// square-ish, they look bigger than the wide tier invaders at the same box size.
export const STATE_SHAPE_SCALE = 0.8;

export type MarkerDisplay = (typeof MARKER_DISPLAYS)[number];

export function markerKey(tier: TierPts, display: MarkerDisplay, group?: StateGroup | null): string {
  const base = `marker-${tier}pts-${display}`;
  return group ? `${base}-${STATE_GROUP_SUFFIX[group]}` : base;
}

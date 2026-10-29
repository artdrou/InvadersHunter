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

// Every marker look of one tier, as used in iconKeys: `marker-30pts-${display}`.
export const MARKER_DISPLAYS = [
  'rarity', 'flash-captured', 'flash-uncaptured', 'flash-mine', 'flash-friend', 'highlight', 'grey',
] as const;

export type MarkerDisplay = (typeof MARKER_DISPLAYS)[number];

export function markerKey(tier: TierPts, display: MarkerDisplay, group?: StateGroup | null): string {
  const base = `marker-${tier}pts-${display}`;
  return group ? `${base}-${STATE_GROUP_SUFFIX[group]}` : base;
}

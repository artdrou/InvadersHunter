export type TierPts = 10 | 20 | 30 | 40 | 50 | 100;

export const TIER_VALUES: TierPts[] = [10, 20, 30, 40, 50, 100];

// The 4 marker states the user can recolor (icon + glow). "rarity" mode keeps
// its fixed per-tier palette (not exposed in the customization UI) but its
// shape still follows the user's shapeForTier reassignment.
export type CustomizableState = 'flashCaptured' | 'flashUncaptured' | 'highlight' | 'grey';

export type MarkerPalette = {
  icon: string;
  glow: string;
};

export type MarkerColorPrefs = Record<CustomizableState, MarkerPalette>;

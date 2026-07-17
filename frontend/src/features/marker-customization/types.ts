export type TierPts = 10 | 20 | 30 | 40 | 50 | 100;

export const TIER_VALUES: TierPts[] = [10, 20, 30, 40, 50, 100];

// The marker states the user can recolor (icon + glow). "rarity" mode keeps
// its fixed per-tier palette (not exposed in the customization UI) but its
// shape still follows the user's shapeForTier reassignment.
//
// "custom" is the palette for personal invaders. Unlike the others it's opt-in
// (markerCustomizationStore.customColorEnabled): off, personal invaders render
// exactly like community ones; on, this palette wins over flash/rarity/grey for
// every personal invader.
export type CustomizableState = 'flashCaptured' | 'flashUncaptured' | 'highlight' | 'grey' | 'custom';

export type MarkerPalette = {
  icon: string;
  glow: string;
};

export type MarkerColorPrefs = Record<CustomizableState, MarkerPalette>;

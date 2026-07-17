import type { CustomInvader } from './types';

const RARITY_VALUES = new Set([10, 20, 30, 40, 50, 100]);
const FALLBACK_RARITY = 30;

/**
 * Personal invaders reuse the rarity sprites so they still read as invaders —
 * the "personal" signal comes from the halo and the label around them
 * (see CustomInvaderSource), not from a bespoke icon.
 *
 * They deliberately have no captured/uncaptured variant: they're the owner's own
 * markers, not part of the community flash game.
 */
export function customIconKey(points: number | null | undefined): string {
  const rarity = points != null && RARITY_VALUES.has(points) ? points : FALLBACK_RARITY;
  return `marker-${rarity}pts-rarity`;
}

/** Only rows with a real position can be drawn. */
export function isMappable(
  invader: CustomInvader,
): invader is CustomInvader & { latitude: number; longitude: number } {
  return invader.latitude != null && invader.longitude != null;
}

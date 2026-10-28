import type { TierPts } from '@/features/marker-customization/types';

/** Profile icon, drawn like a map marker: silhouette + body color + glow color + glow preset (0..8). */
export type Avatar = {
  shape: TierPts;
  icon: string;
  glow: string;
  bloom: number;
};

/** What a player who never picked one gets: the 20 pts "flashed" marker. */
export const DEFAULT_AVATAR: Avatar = { shape: 20, icon: '#1CF0FF', glow: '#002FA7', bloom: 4 };

export function sameAvatar(a: Avatar, b: Avatar): boolean {
  return a.shape === b.shape && a.icon === b.icon && a.glow === b.glow && a.bloom === b.bloom;
}

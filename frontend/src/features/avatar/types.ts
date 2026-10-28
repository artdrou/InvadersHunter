import type { TierPts } from '@/features/marker-customization/types';
import { SHAPE_IDS, SHAPE_SVG } from '@/features/marker-customization/shapes';
import { renderShapeBase64 } from '@/features/marker-customization/generate-markers';
import { AVATAR_SHAPE_IDS, AVATAR_SHAPE_SVG, type AvatarShapeId } from './shapes';

/** The 6 map marker silhouettes, then the profile-only ones. */
export type AvatarShape = TierPts | AvatarShapeId;
export const AVATAR_SHAPES: AvatarShape[] = [...SHAPE_IDS, ...AVATAR_SHAPE_IDS];

/** Profile icon, drawn like a map marker: silhouette + body color + glow color + glow preset (0..8). */
export type Avatar = {
  shape: AvatarShape;
  icon: string;
  glow: string;
  bloom: number;
};

/** What a player who never picked one gets: the 20 pts "flashed" marker. */
export const DEFAULT_AVATAR: Avatar = { shape: 20, icon: '#1CF0FF', glow: '#002FA7', bloom: 4 };

export function sameAvatar(a: Avatar, b: Avatar): boolean {
  return a.shape === b.shape && a.icon === b.icon && a.glow === b.glow && a.bloom === b.bloom;
}

/** SVG of a silhouette; undefined for one this app version doesn't know (picked on a newer one). */
export function avatarShapeSvg(shape: AvatarShape): string | undefined {
  return typeof shape === 'number' ? SHAPE_SVG[shape] : AVATAR_SHAPE_SVG[shape];
}

/**
 * PNG (base64) of a silhouette in the given colors; null for an unknown shape.
 * Marker shapes are colored as on the map; profile-only ones keep their body
 * exactly the chosen color. Throws if Skia fails.
 */
export function renderAvatarBase64(shape: AvatarShape, icon: string, glow: string | null, size: number, bloom?: number): string | null {
  const svg = avatarShapeSvg(shape);
  return svg ? renderShapeBase64(svg, icon, glow, size, bloom, typeof shape === 'string') : null;
}

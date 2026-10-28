import type { ShapeId } from '@/features/marker-customization/types';
import { ALL_SHAPE_IDS, shapeSvg } from '@/features/marker-customization/shapes';
import { renderMarkerBase64 } from '@/features/marker-customization/generate-markers';

/** Same pool as the map markers: the 6 tier shapes, then the extras. */
export type AvatarShape = ShapeId;
export const AVATAR_SHAPES: AvatarShape[] = ALL_SHAPE_IDS;

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

/**
 * PNG (base64) of a silhouette in the given colors (same drawing as the map
 * markers); null for a shape this app version doesn't know. Throws if Skia fails.
 */
export function renderAvatarBase64(shape: AvatarShape, icon: string, glow: string | null, size: number, bloom?: number): string | null {
  return shapeSvg(shape) ? renderMarkerBase64(shape, icon, glow, size, bloom) : null;
}

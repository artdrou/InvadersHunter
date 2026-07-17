import type { InvaderWithState } from '@/features/invaders';
import type { CustomInvader } from './types';

/** Only rows with a real position can be drawn. */
export function isMappable(
  invader: CustomInvader,
): invader is CustomInvader & { latitude: number; longitude: number } {
  return invader.latitude != null && invader.longitude != null;
}

/**
 * Adapt a personal invader to the shape the shared map code expects, so it goes
 * through the exact same marker pipeline (sprite per points tier, colour mode,
 * grey mode) as a community one.
 *
 * `isCaptured` is always false: personal invaders aren't part of the flash game.
 * `isPending` mirrors the offline dim used for a not-yet-synced flash.
 *
 * `points` carries the owner's picked silhouette when there is one: the pipeline
 * keys the sprite off `points`, so this is what makes the icon carousel's choice
 * show up on the map. Falls back to the real points — i.e. no pick means it
 * looks exactly like a community invader of the same tier.
 */
export function toInvaderLike(invader: CustomInvader): InvaderWithState {
  return {
    id: invader.id,
    name: invader.name,
    city: invader.city,
    number: invader.number,
    description: invader.description ?? '',
    state: invader.state,
    latitude: invader.latitude,
    longitude: invader.longitude,
    points: invader.icon_shape ?? invader.points,
    date_pose: invader.date_pose,
    image_url: invader.image_url,
    updated_at: invader.updated_at,
    isCaptured: false,
    isPending: invader.is_pending === 1,
  };
}

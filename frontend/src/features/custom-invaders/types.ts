import type { InvaderState } from '@/features/invaders/types';
import type { TierPts } from '@/features/marker-customization/types';

/**
 * A personal invader — private to its owner, never part of the community
 * dataset. Shape mirrors {@link Invader} so both render through the same map
 * and marker code; the extra fields are what makes it "personal".
 */
export type CustomInvader = {
  /** Negative while the row only exists locally (guest, or created offline);
   *  rewritten to the server id once claimed or synced. */
  id: number;
  user_id: number;
  name: string;
  city?: string | null;
  number?: number | null;
  image_url: string | null;
  description: string | null;
  points: number | null;
  state: InvaderState | null;
  latitude: number | null;
  longitude: number | null;
  date_pose: string | null;
  /** Marker silhouette picked by the owner, named by point tier.
   *  null → follow `points`, i.e. look like a community invader of that tier. */
  icon_shape?: TierPts | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** 1 = written offline, waiting to reach the server; 0 = server-confirmed.
   *  Guest rows stay 0 — local-only is their normal state, not a pending sync. */
  is_pending?: number;
};

/** True for a row that has never reached the server (temporary local id). */
export function isLocalOnly(invader: Pick<CustomInvader, 'id'>): boolean {
  return invader.id < 0;
}

/**
 * True while image_url still points at a picked file on this device rather than
 * an uploaded R2 url. Photos can only be uploaded once the row has a real server
 * id, so a guest's (or an offline) photo waits here until the row lands — see
 * pushPendingPhotos() in services/sync.ts.
 */
export function isLocalPhoto(url: string | null | undefined): boolean {
  return !!url && !/^https?:\/\//.test(url);
}

export type CustomInvaderDraft = {
  name: string;
  city?: string | null;
  number?: number | null;
  description?: string | null;
  points?: number | null;
  state?: string | null;
  latitude: number;
  longitude: number;
  date_pose?: string | null;
  icon_shape?: TierPts | null;
};

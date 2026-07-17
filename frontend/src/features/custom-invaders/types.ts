import type { InvaderState } from '@/features/invaders/types';

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
};

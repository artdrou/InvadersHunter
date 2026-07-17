import { api } from '@/services/api-client';
import type { CustomInvader } from '@/features/custom-invaders/types';

export type ClaimCapturePayload = {
  invader_id: number;
  found_at?: string | null;
};

export type ClaimCustomInvaderPayload = {
  /** The row's temporary negative local id — echoed back so the client can
   *  rewrite the local row onto the real server id. */
  local_id: number;
  name: string;
  city?: string | null;
  number?: number | null;
  description?: string | null;
  points?: number | null;
  state?: string | null;
  latitude: number | null;
  longitude: number | null;
  date_pose?: string | null;
};

export type ClaimResult = {
  custom_invaders: { local_id: number; invader: CustomInvader }[];
};

/**
 * Bulk-import guest data into the authenticated account (guest → account
 * migration). Captures are idempotent server-side (duplicates and unknown
 * invaders are skipped), so retrying after a network failure is safe.
 *
 * Custom invaders have no natural key to dedupe on, so they are only sent while
 * the client still holds guest rows and drops them on success — see
 * claimGuestData() in services/sync.ts.
 */
export async function claimGuestData(
  captures: ClaimCapturePayload[],
  customInvaders: ClaimCustomInvaderPayload[] = [],
): Promise<ClaimResult> {
  const res = await api.post('/account/claim', { captures, custom_invaders: customInvaders });
  return res.data;
}

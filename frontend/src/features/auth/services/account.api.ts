import { api } from '@/services/api-client';

export type ClaimCapturePayload = {
  invader_id: number;
  found_at?: string | null;
};

/**
 * Bulk-import guest captures into the authenticated account (guest → account
 * migration). Idempotent server-side: duplicates and unknown invaders are
 * skipped, so retrying after a network failure is safe.
 */
export async function claimCaptures(captures: ClaimCapturePayload[]): Promise<void> {
  await api.post('/account/claim', { captures });
}

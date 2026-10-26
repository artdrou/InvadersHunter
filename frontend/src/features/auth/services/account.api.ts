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

/** Rename the signed-in account. Rejects with HTTP 400 when the name is taken. */
export async function updateMyUsername(userId: number, username: string): Promise<void> {
  await api.put(`/users/${userId}`, { username });
}

/** GDPR right of access: the backend emails a copy of all the account's data to its own address. */
export async function requestMyDataExport(userId: number): Promise<void> {
  await api.post(`/users/${userId}/data-export`);
}

/** Permanently delete the signed-in account and everything it owns (a confirmation email follows). */
export async function deleteMyAccount(userId: number): Promise<void> {
  await api.delete(`/users/${userId}`);
}

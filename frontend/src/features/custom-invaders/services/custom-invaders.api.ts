import { api } from '@/services/api-client';
import type { CustomInvader, CustomInvaderDraft } from '../types';

/**
 * Personal invaders — every endpoint is owner-scoped server-side (the owner comes
 * from the token), so none of these take a user_id.
 */

/** Pass an ISO timestamp to get only rows changed since then (delta sync). */
export async function fetchCustomInvaders(updatedSince?: string): Promise<CustomInvader[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/custom-invaders/', { params });
  return res.data;
}

/** Ids deleted server-side (possibly from another device) — prune them locally. */
export async function fetchDeletedCustomInvaderIds(updatedSince?: string): Promise<number[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/custom-invaders/deleted', { params });
  return res.data.ids;
}

export async function createCustomInvader(draft: CustomInvaderDraft): Promise<CustomInvader> {
  const res = await api.post('/custom-invaders/', draft);
  return res.data;
}

export async function updateCustomInvader(
  id: number,
  fields: Partial<CustomInvaderDraft>,
): Promise<CustomInvader> {
  const res = await api.put(`/custom-invaders/${id}`, fields);
  return res.data;
}

export async function deleteCustomInvader(id: number): Promise<void> {
  await api.delete(`/custom-invaders/${id}`);
}

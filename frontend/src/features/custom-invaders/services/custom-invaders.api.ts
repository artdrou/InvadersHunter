import { api, BASE_URL } from '@/services/api-client';
import { useAuthStore } from '@/features/auth/store';
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

/**
 * Upload a photo for one of the caller's personal invaders. The server crops it,
 * stores it in R2 and sets image_url — same pipeline as community invader photos.
 * Returns the public URL.
 */
export async function uploadCustomInvaderPhoto(id: number, uri: string): Promise<string> {
  const formData = new FormData();
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  // RN's FormData accepts a { uri, name, type } file object that the DOM Blob typing doesn't model.
  formData.append('file', { uri, name: `photo.${ext}`, type: mimeType } as unknown as Blob);

  // Bypass axios — its fetch adapter doesn't preserve RN's { uri, name, type }
  // FormData entries (same reason as uploadRequestPhoto).
  const token = useAuthStore.getState().token;
  const res = await fetch(`${BASE_URL}/upload/custom-invader-photo/${id}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.url;
}

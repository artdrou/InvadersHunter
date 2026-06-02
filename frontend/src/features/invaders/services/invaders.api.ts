import { api, BASE_URL } from '@/services/api-client';
import { useAuthStore } from '@/features/auth/store';
import type { Invader, Capture, UserRequest } from '../types';

/**
 * Fetch invaders from the server.
 * Pass an ISO timestamp as `updatedSince` to get only rows changed after that point (delta sync).
 * Omit it to get all invaders (full sync on first launch).
 */
export async function fetchInvaders(updatedSince?: string): Promise<Invader[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/invaders/', { params });
  return res.data;
}

export async function fetchProgress(userId: number, updatedSince?: string): Promise<Capture[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get(`/progress/user/${userId}`, { params });
  return res.data;
}

export async function flashInvader(userId: number, invaderId: number): Promise<Capture> {
  const res = await api.post('/progress/', { user_id: userId, invader_id: invaderId });
  return res.data;
}

export async function unflashInvader(progressId: number): Promise<void> {
  await api.delete(`/progress/${progressId}`);
}

export type ModifyRequestPayload = {
  invader_id: number;
  proposed_name?: string | null;
  proposed_description?: string | null;
  proposed_latitude?: number | null;
  proposed_longitude?: number | null;
  proposed_points?: number | null;
  proposed_state?: string | null;
};

export async function submitModifyRequest(payload: ModifyRequestPayload): Promise<void> {
  await api.post('/requests/', { request_type: 'modify', ...payload });
}

export type CreateRequestPayload = {
  proposed_name: string;
  proposed_latitude: number;
  proposed_longitude: number;
  proposed_state?: string | null;
  proposed_points?: number | null;
  proposed_description?: string | null;
  /** Installation year, sent as an ISO date (YYYY-01-01). */
  proposed_date_pose?: string | null;
};

export async function submitCreateRequest(payload: CreateRequestPayload): Promise<UserRequest> {
  const res = await api.post('/requests/', { request_type: 'create', ...payload });
  return res.data;
}

export async function uploadRequestPhoto(requestId: number, uri: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);

  // Bypass axios — its fetch adapter doesn't preserve RN's { uri, name, type }
  // FormData entries. Native fetch handles them correctly via the RN polyfill,
  // and lets the platform set the multipart boundary in Content-Type.
  const token = useAuthStore.getState().token;
  const res = await fetch(`${BASE_URL}/upload/request-photo/${requestId}`, {
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

export async function fetchDeletedInvaderIds(updatedSince?: string): Promise<number[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/invaders/deleted', { params });
  return res.data.ids;
}

export async function cancelRequest(requestId: number): Promise<void> {
  await api.delete(`/requests/${requestId}`);
}

export async function fetchUserRequests(updatedSince?: string): Promise<UserRequest[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/requests/', { params });
  return res.data;
}

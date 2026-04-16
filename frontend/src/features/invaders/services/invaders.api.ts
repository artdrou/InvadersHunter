import { api } from '@/services/api-client';
import type { Invader, Capture, UserRequest } from '../types';

/**
 * Fetch invaders from the server.
 * Pass an ISO timestamp as `updatedSince` to get only rows changed after that point (delta sync).
 * Omit it to get all invaders (full sync on first launch).
 */
export async function fetchInvaders(updatedSince?: string): Promise<Invader[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/invaders', { params });
  return res.data;
}

export async function fetchProgress(userId: number): Promise<Capture[]> {
  const res = await api.get(`/progress/user/${userId}`);
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
  proposed_name?: string;
  proposed_description?: string;
  proposed_latitude?: number;
  proposed_longitude?: number;
  proposed_points?: number;
  proposed_state?: string;
};

export async function submitModifyRequest(payload: ModifyRequestPayload): Promise<void> {
  await api.post('/requests/', { request_type: 'modify', ...payload });
}

export async function fetchUserRequests(): Promise<UserRequest[]> {
  const res = await api.get('/requests/');
  return res.data;
}

export async function hasPendingModifyRequest(invaderId: number): Promise<boolean> {
  const requests = await fetchUserRequests();
  return requests.some(
    (r) => r.invader_id === invaderId && r.request_type === 'modify' && r.status === 'pending',
  );
}

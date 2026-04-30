import { api } from '@/services/api-client';
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
};

export async function submitCreateRequest(payload: CreateRequestPayload): Promise<UserRequest> {
  const res = await api.post('/requests/', { request_type: 'create', ...payload });
  return res.data;
}

export async function uploadRequestPhoto(requestId: number, uri: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const res = await api.post(`/upload/request-photo/${requestId}`, formData);
  return res.data.url;
}

export async function fetchDeletedInvaderIds(updatedSince?: string): Promise<number[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/invaders/deleted', { params });
  return res.data.ids;
}

export async function fetchUserRequests(updatedSince?: string): Promise<UserRequest[]> {
  const params = updatedSince ? { updated_since: updatedSince } : {};
  const res = await api.get('/requests/', { params });
  return res.data;
}

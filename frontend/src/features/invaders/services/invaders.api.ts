import { api } from '@/services/api-client';
import type { Invader, Capture } from '../types';

export async function fetchInvaders(): Promise<Invader[]> {
  const res = await api.get('/invaders');
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

export async function hasPendingModifyRequest(invaderId: number): Promise<boolean> {
  const res = await api.get('/requests/');
  return res.data.some(
    (r: { invader_id: number; request_type: string; status: string }) =>
      r.invader_id === invaderId && r.request_type === 'modify' && r.status === 'pending'
  );
}

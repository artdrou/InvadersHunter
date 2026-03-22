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

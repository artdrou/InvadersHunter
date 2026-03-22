import { api } from '@/services/api-client';
import type { Invader, Capture } from '../types';

export async function fetchInvaders(): Promise<Invader[]> {
  const res = await api.get('/invaders');
  return res.data;
}

export async function fetchProgress(userId: number): Promise<Capture[]> {
  const res = await api.get(`/progress/user/${userId}`);
  return res.data.map((inv: { id: number }) => ({ invader_id: inv.id, user_id: userId }));
}

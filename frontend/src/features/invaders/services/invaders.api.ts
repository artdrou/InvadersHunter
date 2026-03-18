import { api } from '@/services/api-client';
import type { Invader, Capture } from '../types';

export async function fetchInvaders(): Promise<Invader[]> {
  const res = await api.get('/invaders');
  return res.data;
}

export async function fetchProgress(): Promise<Capture[]> {
  const res = await api.get('/progress');
  return res.data;
}

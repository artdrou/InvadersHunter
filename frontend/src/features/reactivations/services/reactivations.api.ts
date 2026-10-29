import { api } from '@/services/api-client';
import type { Reactivation } from '../types';

/** Invaders reactivated in the last 60 days, latest per invader. */
export async function fetchReactivations(): Promise<Reactivation[]> {
  const res = await api.get('/news/reactivations');
  return res.data;
}

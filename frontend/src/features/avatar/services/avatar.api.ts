import { api } from '@/services/api-client';
import type { Avatar } from '../types';

/** My profile icon; null = the default one. */
export async function fetchMyAvatar(): Promise<Avatar | null> {
  const res = await api.get('/avatar/me');
  return res.data.avatar;
}

/** Save my profile icon (null = back to the default). Returns what the server kept. */
export async function saveMyAvatar(avatar: Avatar | null): Promise<Avatar | null> {
  const res = await api.put('/avatar/me', { avatar });
  return res.data.avatar;
}

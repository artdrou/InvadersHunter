import { api } from '@/services/api-client';
import type { FriendsOverview, FriendRequestResult, FriendProfile, FriendLookup } from '../types';

export async function fetchFriendsOverview(): Promise<FriendsOverview> {
  const res = await api.get('/friends/');
  return res.data;
}

/** Exact (case-insensitive) username → the user, or null when nobody has that name. */
export async function lookupUsername(username: string): Promise<FriendLookup | null> {
  try {
    const res = await api.get('/friends/lookup', { params: { username } });
    return res.data;
  } catch (err) {
    if ((err as { response?: { status?: number } })?.response?.status === 404) return null;
    throw err;
  }
}

export async function sendFriendRequest(username: string): Promise<FriendRequestResult> {
  const res = await api.post('/friends/requests', { username });
  return res.data;
}

export async function acceptFriendRequest(friendshipId: number): Promise<void> {
  await api.post(`/friends/requests/${friendshipId}/accept`);
}

/** Decline an invite, cancel one you sent, or remove a friend. */
export async function removeFriendship(friendshipId: number): Promise<void> {
  await api.delete(`/friends/${friendshipId}`);
}

export async function fetchFriendProfile(userId: number): Promise<FriendProfile> {
  const res = await api.get(`/friends/users/${userId}/profile`);
  return res.data;
}

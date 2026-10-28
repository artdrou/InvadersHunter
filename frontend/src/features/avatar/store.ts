import { useEffect } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/features/auth/store';
import { fetchMyAvatar, saveMyAvatar } from './services/avatar.api';
import type { Avatar } from './types';

// Last known icon, per account, so it shows offline / before the request returns
const cacheKey = (userId: number) => `app-avatar-${userId}`;

type AvatarState = {
  userId: number | null;
  avatar: Avatar | null;
  load: (userId: number) => Promise<void>;
  save: (userId: number, avatar: Avatar | null) => Promise<void>;
};

export const useAvatarStore = create<AvatarState>((set, get) => ({
  userId: null,
  avatar: null,

  load: async (userId) => {
    if (get().userId !== userId) {
      let cached: Avatar | null = null;
      try {
        const raw = await AsyncStorage.getItem(cacheKey(userId));
        if (raw) cached = JSON.parse(raw);
      } catch {}
      set({ userId, avatar: cached });
    }
    try {
      const avatar = await fetchMyAvatar();
      if (get().userId !== userId) return;
      set({ avatar });
      AsyncStorage.setItem(cacheKey(userId), JSON.stringify(avatar)).catch(() => {});
    } catch {
      // offline: keep the cached one
    }
  },

  // Throws when the server refuses / is unreachable, so the editor can say so
  save: async (userId, avatar) => {
    const saved = await saveMyAvatar(avatar);
    set({ userId, avatar: saved });
    AsyncStorage.setItem(cacheKey(userId), JSON.stringify(saved)).catch(() => {});
  },
}));

/** My profile icon (null = default; always null for guests), fetched once per account. */
export function useMyAvatar(): Avatar | null {
  const userId = useAuthStore((s) => (s.isGuest ? null : s.user?.id ?? null));
  const avatar = useAvatarStore((s) => (s.userId === userId ? s.avatar : null));
  const load = useAvatarStore((s) => s.load);
  useEffect(() => {
    if (userId != null) load(userId);
  }, [userId, load]);
  return avatar;
}

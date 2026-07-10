import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from './types';

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  /** Guest mode: app usable without an account, data stays in local SQLite. */
  isGuest: boolean;
  _hasHydrated: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  enterGuestMode: () => void;
  setHasHydrated: (val: boolean) => void;
};

function parseToken(token: string): User {
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return { id: Number(payload.sub), username: payload.username, is_admin: payload.is_admin };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isGuest: false,
      _hasHydrated: false,
      login: (accessToken, refreshToken) =>
        // Logging in ends guest mode; local guest data is claimed by the next sync
        set({ token: accessToken, refreshToken, user: parseToken(accessToken), isGuest: false }),
      setTokens: (accessToken, refreshToken) =>
        set({ token: accessToken, refreshToken }),
      logout: () => set({ token: null, refreshToken: null, user: null, isGuest: false }),
      enterGuestMode: () => set({ isGuest: true }),
      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

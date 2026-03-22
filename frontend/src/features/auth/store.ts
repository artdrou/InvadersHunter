import { create } from 'zustand';
import type { User } from './types';

type AuthState = {
  token: string | null;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
};

function parseToken(token: string): User {
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return { id: Number(payload.sub), username: payload.username, is_admin: payload.is_admin };
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  login: (token) => set({ token, user: parseToken(token) }),
  logout: () => set({ token: null, user: null }),
}));

import axios, { isAxiosError } from 'axios';
import { useAuthStore } from '@/features/auth/store';
import { createSingleFlight } from './single-flight';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

export const api = axios.create({ baseURL: BASE_URL });

/** The invader catalog isn't public: in guest mode, requests carry an anonymous
 *  pass (POST /auth/guest, valid 30 days). Fetched on first need, renewed on 401. */
const guestPassFlight = createSingleFlight();

function fetchGuestPass(): Promise<void> {
  return guestPassFlight.run(async () => {
    const res = await axios.post(`${BASE_URL}/auth/guest`);
    useAuthStore.getState().setGuestToken(res.data.access_token);
  });
}

api.interceptors.request.use(async (config) => {
  const { token, isGuest } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (isGuest) {
    if (!useAuthStore.getState().guestToken) {
      await fetchGuestPass().catch(() => {});  // offline: the request fails on its own
    }
    const guestToken = useAuthStore.getState().guestToken;
    if (guestToken) config.headers.Authorization = `Bearer ${guestToken}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: ((token: string) => void)[] = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/')
    ) {
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, logout, isGuest, setGuestToken } = useAuthStore.getState();
    if (!refreshToken && isGuest) {
      // Expired guest pass: get a new one and retry once (never leaves guest mode)
      original._retry = true;
      setGuestToken(null);
      try {
        await fetchGuestPass();
      } catch {
        return Promise.reject(error);
      }
      return api(original);
    }
    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
      const newAccess: string = res.data.access_token;
      const newRefresh: string = res.data.refresh_token;
      setTokens(newAccess, newRefresh);
      original.headers.Authorization = `Bearer ${newAccess}`;
      refreshQueue.forEach((cb) => cb(newAccess));
      refreshQueue = [];
      return api(original);
    } catch {
      logout();
      refreshQueue = [];
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

/**
 * Best-effort extraction of the backend's error `detail` from a thrown value.
 * Our FastAPI endpoints reject with `{ detail: string }`, which axios nests at
 * `error.response.data.detail`. Returns undefined when absent so callers can
 * supply their own localized fallback. Keeps `catch` blocks off `any`.
 */
export function apiErrorDetail(err: unknown): string | undefined {
  if (isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

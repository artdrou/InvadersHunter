import axios from 'axios';
import { useAuthStore } from '@/features/auth/store';

export const BASE_URL = 'http://192.168.1.63:8000';
// export const BASE_URL = 'http://127.0.0.1:8000'; // web / local

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

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

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
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

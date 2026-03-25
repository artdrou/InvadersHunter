import axios from 'axios';
import { useAuthStore } from '@/features/auth/store';

export const api = axios.create({
  // baseURL: 'http://127.0.0.1:8000', // web / local
  baseURL: 'http://192.168.1.63:8000', // android dev (LAN)
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

import { api } from '@/services/api-client';

export async function loginUser(username: string, password: string): Promise<string> {
  const res = await api.post('/auth/login', { username, password });
  return res.data.access_token;
}

export async function registerUser(username: string, email: string, password: string): Promise<string> {
  await api.post('/users/', { username, email, password });
  return loginUser(username, password);
}

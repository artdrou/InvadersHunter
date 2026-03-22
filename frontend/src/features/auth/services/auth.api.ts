import { api } from '@/services/api-client';

export async function loginUser(username: string, password: string): Promise<string> {
  const res = await api.post('/auth/login', { username, password });
  return res.data.access_token;
}

export async function registerUser(username: string, email: string, password: string): Promise<string> {
  await api.post('/users/', { username, email, password });
  return loginUser(username, password);
}

export async function forgotPassword(username: string, email: string): Promise<void> {
  await api.post('/auth/forgot-password', { username, email });
}

export async function verifyResetCode(email: string, token: string): Promise<void> {
  await api.post('/auth/verify-reset-code', { email, token });
}

export async function resetPassword(email: string, token: string, new_password: string): Promise<void> {
  await api.post('/auth/reset-password', { email, token, new_password });
}

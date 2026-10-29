import { isAxiosError } from 'axios';
import { api } from '@/services/api-client';

export async function loginUser(username: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await api.post('/auth/login', { username, password });
  return { accessToken: res.data.access_token, refreshToken: res.data.refresh_token };
}

/** Throws the login's 403 (see isEmailNotVerified) while the email isn't confirmed. */
export async function registerUser(username: string, email: string, password: string, language: string): Promise<{ accessToken: string; refreshToken: string }> {
  await api.post('/users/', { username, email, password, language });
  return loginUser(username, password);
}

/** Login refused because the account's email isn't confirmed yet (→ /verify-email). */
export function isEmailNotVerified(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 403;
}

export async function verifyEmail(username: string, code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await api.post('/auth/verify-email', { username, code });
  return { accessToken: res.data.access_token, refreshToken: res.data.refresh_token };
}

export async function resendVerification(username: string): Promise<void> {
  await api.post('/auth/resend-verification', { username });
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refresh_token: refreshToken });
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

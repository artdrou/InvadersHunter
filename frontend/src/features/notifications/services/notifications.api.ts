import { api } from '@/services/api-client';
import type { NotificationPrefs, GlobalNotificationSettings } from '../types';

export async function registerPushToken(token: string, platform: string): Promise<void> {
  await api.post('/notifications/push-token', { token, platform });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await api.delete(`/notifications/push-token/${encodeURIComponent(token)}`);
}

export async function fetchMyNotificationPrefs(): Promise<NotificationPrefs> {
  const res = await api.get('/notifications/me');
  return res.data;
}

export async function updateMyNotificationPrefs(enabled: boolean): Promise<NotificationPrefs> {
  const res = await api.patch('/notifications/me', { notifications_enabled: enabled });
  return res.data;
}

/** Admin-only: the global switches that gate every invader push notification. */
export async function fetchGlobalNotificationSettings(): Promise<GlobalNotificationSettings> {
  const res = await api.get('/notifications/settings');
  return res.data;
}

export async function updateGlobalNotificationSettings(
  fields: Partial<Pick<GlobalNotificationSettings, 'enabled' | 'notify_on_create' | 'notify_on_update'>>,
): Promise<GlobalNotificationSettings> {
  const res = await api.patch('/notifications/settings', fields);
  return res.data;
}

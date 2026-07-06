import type { LanguageCode } from '@/services/i18n';

export type NotificationPrefs = {
  notifications_enabled: boolean;
  language: LanguageCode;
};

export type GlobalNotificationSettings = {
  enabled: boolean;
  notify_on_create: boolean;
  notify_on_update: boolean;
  updated_at: string | null;
};

/** Payload attached to invader push notifications (see backend notify_invader_event). */
export type NotificationTapData = {
  screen?: string;
  invader_id?: number | null;
};

import type { NotificationTapData } from './types';

export type AppVariant = 'development' | 'staging' | 'production';

/**
 * Which app this is, from its Android package (see app.config.js variants).
 * Sent with the push token so each backend only pushes to its own app — the
 * 3 databases were copied from one original and share old device tokens.
 */
export function appVariantFromPackage(androidPackage: string | null | undefined): AppVariant {
  if (androidPackage?.endsWith('.dev')) return 'development';
  if (androidPackage?.endsWith('.stag')) return 'staging';
  return 'production';
}

/** Screens a push notification may open. Anything else falls back to News. */
const TAP_SCREENS = ['/news', '/social'] as const;
export type NotificationTapScreen = (typeof TAP_SCREENS)[number];

/**
 * Where a tap on a push notification should navigate to. Kept pure and
 * separate from the native listener so it's trivial to unit-test.
 * Invader events open the News feed; friend invites / accepts open Social.
 */
export function resolveNotificationTapScreen(data: NotificationTapData | undefined | null): NotificationTapScreen {
  const screen = data?.screen;
  return TAP_SCREENS.find((s) => s === screen) ?? '/news';
}

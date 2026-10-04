import type { NotificationTapData } from './types';

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

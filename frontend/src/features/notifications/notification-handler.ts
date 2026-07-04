import type { NotificationTapData } from './types';

/**
 * Where a tap on a push notification should navigate to. Kept pure and
 * separate from the native listener so it's trivial to unit-test.
 * Every invader event we send today opens the News feed.
 */
export function resolveNotificationTapScreen(data: NotificationTapData | undefined | null): '/news' {
  return (data?.screen as '/news' | undefined) ?? '/news';
}

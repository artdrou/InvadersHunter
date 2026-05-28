/**
 * Centralized haptic feedback helpers. Every call is gated on the user
 * preference from `useHapticsStore` so disabling vibrations from Settings
 * silences the entire app at the source.
 *
 * Three flavors:
 *  - tap()        : light tick on any button press that triggers an action
 *  - success()    : long celebratory pulse for flashing an invader
 *  - disappoint() : warning-style pulse for unflashing (small "oh no" feel)
 *
 * Always call without await unless ordering matters — the haptic is fire-and-
 * forget and we never want it to block the UI action that triggered it.
 */
import * as Haptics from 'expo-haptics';
import { useHapticsStore } from './haptics-store';

function enabled(): boolean {
  return useHapticsStore.getState().enabled;
}

/** Light tick — use for any button press that actually does something. */
export function tap(): void {
  if (!enabled()) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Long, celebratory pulse — flash success. */
export function success(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Disappointing double-pulse — unflash. */
export function disappoint(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

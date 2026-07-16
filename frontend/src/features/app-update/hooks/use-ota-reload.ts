import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Auto-applies OTA updates for users who never cold-start the app.
 *
 * expo-updates' default (checkAutomatically: ON_LOAD) only checks at cold
 * launch and applies the new bundle on the *next* launch. Someone who merely
 * backgrounds and resumes the app — never killing it — therefore never sees an
 * OTA. This hook checks on foreground and, when an update is ready, fetches and
 * reloads the JS bundle in place.
 *
 * A reload only ever happens when an update is actually available (so, once,
 * right after you publish an OTA), and only after the app has been in the
 * background long enough that resuming already feels like a fresh session — so
 * it never yanks the UI during a quick app-switch. The rest of the time the
 * foreground check is a cheap no-op.
 */

// Past this much time backgrounded, an in-place reload reads as a fresh launch.
const BG_RELOAD_THRESHOLD_MS = 3 * 60 * 1000; // 3 min
// Spare battery/network: at most one update check per this window.
const CHECK_COOLDOWN_MS = 60 * 1000; // 1 min

export function useOtaReload(enabled: boolean) {
  const backgroundedAt = useRef<number | null>(null);
  const lastCheckAt = useRef(0);

  useEffect(() => {
    // Updates.isEnabled is false in Expo Go / dev, where these calls throw.
    if (!enabled || !Updates.isEnabled) return;

    async function checkAndReload() {
      const now = Date.now();
      if (now - lastCheckAt.current < CHECK_COOLDOWN_MS) return;
      lastCheckAt.current = now;
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync(); // restarts JS with the freshly fetched bundle
      } catch {
        // Offline or nothing new — retry on the next qualifying foreground.
      }
    }

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        const bgAt = backgroundedAt.current;
        backgroundedAt.current = null;
        if (bgAt !== null && Date.now() - bgAt >= BG_RELOAD_THRESHOLD_MS) {
          checkAndReload();
        }
      } else if (backgroundedAt.current === null) {
        // First transition into background/inactive — start the clock.
        backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [enabled]);
}

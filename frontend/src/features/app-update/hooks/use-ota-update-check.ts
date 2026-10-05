import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import { useAppUpdateStore } from '../store';

/**
 * Surfaces OTA updates for users who never cold-start the app.
 *
 * expo-updates' default (checkAutomatically: ON_LOAD) only checks at cold
 * launch and applies the new bundle on the *next* launch. Someone who merely
 * backgrounds and resumes the app — never killing it — therefore never sees an
 * OTA. This hook checks at mount and on every foreground; when an update is
 * available it downloads it and flags the store, so `OtaReadyModal` can offer
 * the restart. The reload itself is the user's call.
 */

// Spare battery/network: at most one update check per this window.
const CHECK_COOLDOWN_MS = 60 * 1000; // 1 min

export function useOtaUpdateCheck(enabled: boolean) {
  const lastCheckAt = useRef(0);

  useEffect(() => {
    // Updates.isEnabled is false in Expo Go / dev, where these calls throw.
    if (!enabled || !Updates.isEnabled) return;

    async function check() {
      const { otaReady, otaDismissed } = useAppUpdateStore.getState();
      if (otaReady || otaDismissed) return;
      const now = Date.now();
      if (now - lastCheckAt.current < CHECK_COOLDOWN_MS) return;
      lastCheckAt.current = now;
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        await Updates.fetchUpdateAsync();
        useAppUpdateStore.getState().setOtaReady();
      } catch {
        // Offline or nothing new — retry on the next foreground.
      }
    }

    check();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [enabled]);
}

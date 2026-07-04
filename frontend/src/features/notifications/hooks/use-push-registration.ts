import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { registerPushToken } from '../services/notifications.api';
import { resolveNotificationTapScreen } from '../notification-handler';
import { useNotificationsStore } from '../store';
import type { NotificationTapData } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Logs to the console (visible via `adb logcat` on a release build) and
 * stores the outcome so it can also be read from the Notifications settings
 * screen — registration runs headless on app start, with no other UI. */
function logRegistrationOutcome(message: string | null) {
  if (message) console.warn('[push-registration]', message);
  useNotificationsStore.getState().setLastRegistrationError(message);
}

/**
 * Requests notification permission, registers this device's Expo push token
 * with the backend, and navigates to the News feed when the user taps a
 * notification. No-op on simulators/emulators (no push capability) and while
 * logged out (`enabled` should track auth state).
 */
export function usePushRegistration(enabled: boolean) {
  const router = useRouter();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || registeredRef.current) return;
    if (!Device.isDevice) {
      logRegistrationOutcome('skipped: not a physical device (simulator/emulator)');
      return;
    }
    registeredRef.current = true;

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let status = existingStatus;
        if (status !== 'granted') {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status !== 'granted') {
          logRegistrationOutcome(`skipped: permission not granted (status=${status})`);
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken(token, Platform.OS);
        useNotificationsStore.getState().setCurrentToken(token);
        logRegistrationOutcome(null); // clear any stale error from a previous failed attempt
      } catch (err) {
        // Best-effort: no push this session, nothing else depends on it —
        // but surface *why* so it's diagnosable without adb.
        const message = err instanceof Error ? err.message : String(err);
        logRegistrationOutcome(message);
        registeredRef.current = false;
      }
    })();
  }, [enabled]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationTapData;
      router.push(resolveNotificationTapScreen(data));
    });
    return () => sub.remove();
  }, [router]);
}

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
    if (!enabled || registeredRef.current || !Device.isDevice) return;
    registeredRef.current = true;

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let status = existingStatus;
        if (status !== 'granted') {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status !== 'granted') return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken(token, Platform.OS);
        useNotificationsStore.getState().setCurrentToken(token);
      } catch {
        // Best-effort: no push this session, nothing else depends on it.
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

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store';

/**
 * Gate an action behind having an account.
 *
 * Authenticated users run the action directly. Guests get a native alert
 * offering to create an account (→ /register) — the guest's local data is
 * migrated automatically after signup.
 */
export function useRequireAccount() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const router = useRouter();
  const { t } = useTranslation();

  return useCallback(
    (action: () => void) => {
      if (!isGuest) {
        action();
        return;
      }
      Alert.alert(t('guest.gateTitle'), t('guest.gateMessage'), [
        { text: t('guest.gateCancel'), style: 'cancel' },
        { text: t('guest.gateCreate'), onPress: () => router.push('/register') },
      ]);
    },
    [isGuest, router, t],
  );
}

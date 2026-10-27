import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore, requestMyDataExport, deleteMyAccount } from '@/features/auth';
import { SettingsShell, SettingsSection, SettingsRow } from '@/features/settings';
import { useNotificationsStore } from '@/features/notifications';

export default function SecurityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await requestMyDataExport(user.id);
      Alert.alert(t('settings.exportDataSentTitle'), t('settings.exportDataSentBody'));
    } catch {
      Alert.alert(t('settings.exportData'), t('settings.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!user) return;
    setBusy(true);
    try {
      await deleteMyAccount(user.id);
    } catch {
      setBusy(false);
      Alert.alert(t('settings.deleteAccount'), t('settings.actionFailed'));
      return;
    }
    // The server already dropped the push tokens and sessions with the account.
    useNotificationsStore.getState().setCurrentToken(null);
    logout();
    router.replace('/login');
    Alert.alert(t('settings.deleteAccountDoneTitle'), t('settings.deleteAccountDoneBody'));
  }

  function handleDelete() {
    if (!user || busy) return;
    Alert.alert(
      t('settings.deleteAccountConfirmTitle'),
      t('settings.deleteAccountConfirmBody', { username: user.username }),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('settings.deleteAccountConfirm'), style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  return (
    <SettingsShell title={t('settings.security')}>
      <SettingsSection title={t('settings.sectionLogin')}>
        <SettingsRow
          icon="key-outline"
          label={t('settings.changePassword')}
          subtitle={t('settings.changePasswordSubtitle')}
          onPress={() => router.push('/settings/change-password')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionMyData')}>
        <SettingsRow
          icon="mail-outline"
          label={t('settings.exportData')}
          subtitle={t('settings.exportDataSubtitle')}
          onPress={handleExport}
          hideChevron
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionDanger')}>
        <SettingsRow
          icon="trash-outline"
          label={t('settings.deleteAccount')}
          subtitle={t('settings.deleteAccountSubtitle')}
          onPress={handleDelete}
          destructive
          hideChevron
        />
      </SettingsSection>
    </SettingsShell>
  );
}

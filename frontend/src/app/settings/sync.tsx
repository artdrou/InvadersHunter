import { Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useInvaderStore } from '@/features/invaders';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';

export default function SyncScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const isSyncing   = useInvaderStore((s) => s.isSyncing);
  const requestSync = useInvaderStore((s) => s.requestSync);

  return (
    <SettingsShell title={t('settings.sync')}>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={() => { hapticTap(); requestSync(); }}
        disabled={isSyncing}
      >
        <Text style={styles.btnText}>{isSyncing ? t('settings.syncing') : t('settings.syncNow')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={() => { hapticTap(); router.push('/flash-import'); }}
      >
        <Text style={styles.btnText}>{t('settings.importFlashes')}</Text>
      </Pressable>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    btn: {
      paddingVertical: 14,
      paddingHorizontal: Spacing.four,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    btnText: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.lg,
    },
    pressed: { opacity: 0.6 },
  });
}

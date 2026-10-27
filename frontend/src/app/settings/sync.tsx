import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useInvaderStore } from '@/features/invaders';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';
import { useTheme } from '@/contexts/theme-context';

/** Two actions, each in a card that says what it does (they're easy to mix up). */
export default function SyncScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const isSyncing   = useInvaderStore((s) => s.isSyncing);
  const requestSync = useInvaderStore((s) => s.requestSync);

  return (
    <SettingsShell title={t('settings.sync')}>
      <View style={styles.card}>
        <Text style={styles.info}>{t('settings.syncNowInfo')}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => { hapticTap(); requestSync(); }}
          disabled={isSyncing}
        >
          <ShadowText shadowColor={theme.titleShadow} style={styles.btnText}>{isSyncing ? t('settings.syncing') : t('settings.syncNow')}</ShadowText>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.info}>{t('settings.importFlashesInfo')}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => { hapticTap(); router.push('/flash-import'); }}
        >
          <ShadowText shadowColor={theme.titleShadow} style={styles.btnText}>{t('settings.importFlashes')}</ShadowText>
        </Pressable>
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    card: { ...arcadeCard(t), padding: Spacing.three, gap: Spacing.three },
    info: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.sm, lineHeight: 22 },
    btn: {
      paddingVertical: 14,
      paddingHorizontal: Spacing.four,
      ...arcadeButton(t, 'outline'),
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    btnText: {
      ...arcadeButtonLabel(t, 'outline'),
      fontSize: FontSize.md,
    },
    pressed: { opacity: 0.6 },
  });
}

import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';

export default function ProfileInfoScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const user = useAuthStore((s) => s.user);

  return (
    <SettingsShell title={t('settings.profileInfo')}>
      {user && (
        <View style={styles.usernameBlock}>
          <Text style={styles.usernameLabel}>{t('auth.username')}</Text>
          <Text style={styles.username}>{user.username}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.stats')}</Text>
        <View style={styles.placeholderBlock}>
          <Text style={styles.placeholderText}>{t('settings.comingSoon')}</Text>
          <Text style={styles.placeholderBody}>{t('settings.comingSoonBody')}</Text>
        </View>
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    usernameBlock: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
      gap: Spacing.one,
    },
    usernameLabel: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm,
      letterSpacing: 1, textTransform: 'uppercase',
    },
    username: { color: t.accent, fontFamily: ButtonFont, fontSize: ButtonFontSize.xl, letterSpacing: 1 },
    section: { gap: Spacing.two },
    sectionLabel: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm,
      letterSpacing: 1, textTransform: 'uppercase',
    },
    placeholderBlock: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    placeholderText: { color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },
    placeholderBody: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm, lineHeight: 20 },
  });
}

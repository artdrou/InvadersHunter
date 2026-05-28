import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';

export default function SecurityScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <SettingsShell title={t('settings.security')}>
      <View style={styles.placeholderBlock}>
        <Text style={styles.placeholderText}>{t('settings.comingSoon')}</Text>
        <Text style={styles.placeholderBody}>{t('settings.comingSoonBody')}</Text>
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    placeholderBlock: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.four,
      gap: Spacing.two,
      alignItems: 'center',
    },
    placeholderText: { color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },
    placeholderBody: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm, lineHeight: 20, textAlign: 'center' },
  });
}

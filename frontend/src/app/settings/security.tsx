import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';

export default function SecurityScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

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
    placeholderText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    placeholderBody: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 20, textAlign: 'center' },
  });
}

import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';

export default function SupportScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <SettingsShell title={t('settings.support')}>
      <View style={styles.block}>
        <Text style={styles.body}>{t('settings.supportBody')}</Text>
        <View style={styles.placeholderBtn}>
          <Text style={styles.placeholderBtnText}>{t('settings.comingSoon')}</Text>
        </View>
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    block: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    body: { color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.md, lineHeight: 22 },
    placeholderBtn: {
      paddingVertical: 14,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    placeholderBtnText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },
  });
}

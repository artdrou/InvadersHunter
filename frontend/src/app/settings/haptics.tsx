import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';
import { useHapticsStore } from '@/features/settings/haptics-store';

export default function HapticsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const enabled = useHapticsStore((s) => s.enabled);
  const setEnabled = useHapticsStore((s) => s.setEnabled);

  function handleToggle(v: boolean) {
    setEnabled(v);
    // Preview pulse on enable so the user feels what they just turned on.
    if (v) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }

  return (
    <SettingsShell title={t('settings.haptics')}>
      <View style={styles.row}>
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{t('settings.hapticsEnabled')}</Text>
          <Text style={styles.subtitle}>{t('settings.hapticsBody')}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.bgElement}
        />
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
    },
    labelWrap: { flex: 1, gap: 4 },
    label: { color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },
    subtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm, lineHeight: 20 },
  });
}

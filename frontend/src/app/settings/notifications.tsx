import { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';
import { fetchMyNotificationPrefs, updateMyNotificationPrefs } from '@/features/notifications';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMyNotificationPrefs()
      .then((prefs) => setEnabled(prefs.notifications_enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(value: boolean) {
    setEnabled(value); // optimistic
    setSaving(true);
    try {
      const prefs = await updateMyNotificationPrefs(value);
      setEnabled(prefs.notifications_enabled);
    } catch {
      setEnabled(!value); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell title={t('settings.notifications')}>
      <View style={styles.row}>
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{t('settings.notificationsEnabled')}</Text>
          <Text style={styles.subtitle}>{t('settings.notificationsBody')}</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={saving}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={theme.bgElement}
          />
        )}
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
    label: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    subtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 20 },
  });
}

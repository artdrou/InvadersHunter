import { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { fetchGlobalNotificationSettings, updateGlobalNotificationSettings } from '@/features/notifications';
import type { GlobalNotificationSettings } from '@/features/notifications';

type SwitchKey = 'enabled' | 'notify_on_create' | 'notify_on_update';

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont);

  const [settings, setSettings] = useState<GlobalNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SwitchKey | null>(null);

  useEffect(() => {
    fetchGlobalNotificationSettings()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: SwitchKey, value: boolean) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value }); // optimistic
    setSavingKey(key);
    try {
      const updated = await updateGlobalNotificationSettings({ [key]: value });
      setSettings(updated);
    } catch {
      setSettings(previous);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backText}>{`< ${t('common.back')}`}</Text>
        </Pressable>
        <Text style={styles.title}>{t('admin.notificationSettings')}</Text>
      </View>

      {loading || !settings ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <View style={styles.body}>
          <SwitchRow
            label={t('admin.notificationsGlobalEnabled')}
            subtitle={t('admin.notificationsGlobalEnabledSubtitle')}
            value={settings.enabled}
            saving={savingKey === 'enabled'}
            onChange={(v) => handleToggle('enabled', v)}
            styles={styles}
            theme={theme}
          />
          <SwitchRow
            label={t('admin.notificationsOnCreate')}
            subtitle={t('admin.notificationsOnCreateSubtitle')}
            value={settings.notify_on_create}
            saving={savingKey === 'notify_on_create'}
            disabled={!settings.enabled}
            onChange={(v) => handleToggle('notify_on_create', v)}
            styles={styles}
            theme={theme}
          />
          <SwitchRow
            label={t('admin.notificationsOnUpdate')}
            subtitle={t('admin.notificationsOnUpdateSubtitle')}
            value={settings.notify_on_update}
            saving={savingKey === 'notify_on_update'}
            disabled={!settings.enabled}
            onChange={(v) => handleToggle('notify_on_update', v)}
            styles={styles}
            theme={theme}
          />
        </View>
      )}
    </View>
  );
}

function SwitchRow({
  label,
  subtitle,
  value,
  saving,
  disabled,
  onChange,
  styles,
  theme,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  saving: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: ThemeTokens;
}) {
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {saving ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.bgElement}
        />
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.two },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    backText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },
    title: { color: t.accent, fontFamily: font, fontSize: FontSize.xl, letterSpacing: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: Spacing.four, gap: Spacing.three },
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
    rowDisabled: { opacity: 0.5 },
    labelWrap: { flex: 1, gap: 4 },
    label: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    subtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 20 },
    pressed: { opacity: 0.6 },
  });
}

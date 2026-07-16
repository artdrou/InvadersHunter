import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';
import { fetchVersionManifest, getCurrentVersion, isNewer, useAppUpdateStore } from '@/features/app-update';
import { getDateLocale } from '@/services/i18n';

export default function AboutScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);

  const isOta = !Updates.isEmbeddedLaunch;
  const otaDate = Updates.createdAt
    ? Updates.createdAt.toLocaleString(getDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
  const otaChannel = Updates.channel ?? null;

  async function handleCheckForUpdates() {
    hapticTap();
    const manifest = await fetchVersionManifest();
    if (!manifest) {
      Alert.alert(t('common.error'), t('appUpdate.checkFailed'));
      return;
    }
    if (isNewer(manifest.latestVersion, getCurrentVersion())) {
      useAppUpdateStore.setState({ manifest, isAvailable: true, dismissedVersion: null });
    } else {
      Alert.alert(t('appUpdate.upToDateTitle'), t('appUpdate.upToDateBody'));
    }
  }

  return (
    <SettingsShell title={t('settings.about')}>
      <View style={styles.infoBlock}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('settings.appVersion')}</Text>
          <Text style={styles.infoValue}>{getCurrentVersion()}</Text>
        </View>
        {isOta && otaDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>OTA</Text>
            <Text style={styles.infoValue}>{otaDate}</Text>
          </View>
        )}
        {otaChannel && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('settings.buildChannel')}</Text>
            <Text style={styles.infoValue}>{otaChannel}</Text>
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={handleCheckForUpdates}
      >
        <Text style={styles.btnText}>{t('settings.checkForUpdates')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
        onPress={() => { hapticTap(); router.push('/settings/roadmap'); }}
      >
        <Ionicons name="rocket-outline" size={20} color={theme.accent} />
        <View style={styles.navLabelWrap}>
          <Text style={styles.navLabel}>{t('settings.roadmap')}</Text>
          <Text style={styles.navSubtitle}>{t('settings.roadmapSubtitle')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
        onPress={() => { hapticTap(); router.push('/settings/changelog'); }}
      >
        <Ionicons name="document-text-outline" size={20} color={theme.accent} />
        <View style={styles.navLabelWrap}>
          <Text style={styles.navLabel}>{t('settings.changelog')}</Text>
          <Text style={styles.navSubtitle}>{t('settings.changelogSubtitle')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      <View style={styles.creditsBlock}>
        <Text style={styles.creditsTitle}>{t('settings.credits')}</Text>
        <Text style={styles.creditsBody}>{t('settings.creditsBody')}</Text>
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    infoBlock: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },
    infoValue: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    btn: {
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    btnText: { color: t.accent, fontFamily: ButtonFont, fontSize: FontSize.md },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    navLabelWrap: { flex: 1, gap: 2 },
    navLabel: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    navSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    pressed: { opacity: 0.6 },
    creditsBlock: { gap: Spacing.two, paddingTop: Spacing.three },
    creditsTitle: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.sm,
      letterSpacing: 1, textTransform: 'uppercase',
    },
    creditsBody: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.sm, lineHeight: 22 },
  });
}

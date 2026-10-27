import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, ButtonFontBold, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';
import { SettingsRowIcon } from '@/features/settings/components/SettingsRow';
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';
import { ArcadeSectionLabel } from '@/components/ArcadeSectionLabel';
import { ShadowText } from '@/components/ShadowText';
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
        <ShadowText shadowColor={theme.titleShadow} style={styles.btnText}>{t('settings.checkForUpdates')}</ShadowText>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
        onPress={() => { hapticTap(); router.push('/settings/roadmap'); }}
      >
        <SettingsRowIcon icon="rocket-outline" />
        <View style={styles.navLabelWrap}>
          <Text style={styles.navLabel}>{t('settings.roadmap')}</Text>
          <Text style={styles.navSubtitle}>{t('settings.roadmapSubtitle')}</Text>
        </View>
        <Ionicons name="caret-forward" size={14} color={theme.accent} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
        onPress={() => { hapticTap(); router.push('/settings/changelog'); }}
      >
        <SettingsRowIcon icon="document-text-outline" />
        <View style={styles.navLabelWrap}>
          <Text style={styles.navLabel}>{t('settings.changelog')}</Text>
          <Text style={styles.navSubtitle}>{t('settings.changelogSubtitle')}</Text>
        </View>
        <Ionicons name="caret-forward" size={14} color={theme.accent} />
      </Pressable>

      <View style={styles.creditsBlock}>
        <ArcadeSectionLabel title={t('settings.credits')} />
        <Text style={styles.creditsBody}>{t('settings.creditsBody')}</Text>
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    infoBlock: {
      ...arcadeCard(t),
      padding: Spacing.three,
      gap: Spacing.two,
    },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },
    infoValue: { color: t.text, fontFamily: ButtonFontBold, fontSize: FontSize.md },
    btn: {
      paddingVertical: 12,
      ...arcadeButton(t, 'outline'),
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    btnText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.md },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      ...arcadeCard(t),
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two + 2,
    },
    navLabelWrap: { flex: 1, gap: 2 },
    navLabel: { color: t.text, fontFamily: ButtonFontBold, fontSize: FontSize.md },
    navSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    pressed: { opacity: 0.6 },
    creditsBlock: { gap: Spacing.two, paddingTop: Spacing.three },
    creditsBody: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.sm, lineHeight: 22 },
  });
}

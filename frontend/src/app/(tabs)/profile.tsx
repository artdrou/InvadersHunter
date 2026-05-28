/**
 * Settings landing screen (mounted as the "Profile" tab — name kept for route
 * stability; the user-facing label is "Reglages"/"Settings" via t('tabs.profile')).
 *
 * Categorized list of sub-screens. Each row navigates to `src/app/settings/<id>.tsx`.
 * Logout stays directly on this screen (action, not a sub-screen).
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore, logoutUser } from "@/features/auth";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from "@/constants/theme";
import { SettingsSection, SettingsRow } from "@/features/settings";
import { getCurrentVersion } from "@/features/app-update";

export default function SettingsLanding() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, insets.top);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      try { await logoutUser(refreshToken); } catch {}
    }
    logout();
    router.replace('/login');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <SettingsSection title={t('settings.sectionAccount')}>
        <SettingsRow
          icon="person-outline"
          label={t('settings.profileInfo')}
          subtitle={t('settings.profileInfoSubtitle')}
          onPress={() => router.push('/settings/profile-info')}
        />
        <SettingsRow
          icon="lock-closed-outline"
          label={t('settings.security')}
          subtitle={t('settings.securitySubtitle')}
          onPress={() => router.push('/settings/security')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionPersonalization')}>
        <SettingsRow
          icon="color-palette-outline"
          label={t('settings.appearance')}
          subtitle={t('settings.appearanceSubtitle')}
          onPress={() => router.push('/settings/appearance')}
        />
        <SettingsRow
          icon="language-outline"
          label={t('settings.language')}
          onPress={() => router.push('/settings/language')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionData')}>
        <SettingsRow
          icon="sync-outline"
          label={t('settings.sync')}
          subtitle={t('settings.syncSubtitle')}
          onPress={() => router.push('/settings/sync')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionAbout')}>
        <SettingsRow
          icon="information-circle-outline"
          label={t('settings.about')}
          subtitle={t('settings.aboutSubtitle')}
          onPress={() => router.push('/settings/about')}
        />
        <SettingsRow
          icon="mail-outline"
          label={t('settings.contact')}
          subtitle={t('settings.contactSubtitle')}
          onPress={() => router.push('/settings/contact')}
        />
        <SettingsRow
          icon="cafe-outline"
          label={t('settings.support')}
          subtitle={t('settings.supportSubtitle')}
          onPress={() => router.push('/settings/support')}
        />
        <SettingsRow
          icon="rocket-outline"
          label={t('settings.roadmap')}
          subtitle={t('settings.roadmapSubtitle')}
          onPress={() => router.push('/settings/roadmap')}
        />
      </SettingsSection>

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>{t('settings.disconnect')}</Text>
      </Pressable>

      <Text style={styles.footer}>v{getCurrentVersion()}</Text>
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens, font: string, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    content: {
      paddingTop: topInset + Spacing.three,
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.six,
      gap: Spacing.three,
    },
    title: {
      color: t.accent,
      fontFamily: font,
      fontSize: ButtonFontSize.xxl,
      letterSpacing: 1,
    },
    username: {
      color: t.textMuted,
      fontFamily: font,
      fontSize: ButtonFontSize.md,
      marginTop: -Spacing.two,
    },
    logoutBtn: {
      paddingVertical: 14,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.danger,
      alignItems: 'center',
      marginTop: Spacing.three,
    },
    logoutText: {
      color: t.danger,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.lg,
    },
    pressed: { opacity: 0.6 },
    footer: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xs,
      textAlign: 'center',
      opacity: 0.5,
      marginTop: Spacing.two,
    },
  });
}

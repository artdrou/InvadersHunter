/**
 * Settings landing screen (mounted as the "Profile" tab — name kept for route
 * stability; the user-facing label is "Reglages"/"Settings" via t('tabs.profile')).
 *
 * Categorized list of sub-screens. Each row navigates to `src/app/settings/<id>.tsx`.
 * Logout stays directly on this screen (action, not a sub-screen).
 */
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { useAuthStore, useRequireAccount } from "@/features/auth";
import { type ThemeTokens, Spacing, FontSize } from "@/constants/theme";
import { SettingsSection, SettingsRow } from "@/features/settings";

export default function SettingsLanding() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont } = useTheme();
  const insets = useSafeAreaInsets();
  const isGuest = useAuthStore((s) => s.isGuest);
  const requireAccount = useRequireAccount();
  const styles = makeStyles(theme, appFont, insets.top);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <View style={styles.body}>
      <SettingsSection title={t('settings.sectionAccount')}>
        {isGuest ? (
          <SettingsRow
            icon="person-add-outline"
            label={t('guest.createAccount')}
            subtitle={t('guest.createAccountSubtitle')}
            onPress={() => router.push('/register')}
          />
        ) : (
          <>
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
          </>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.sectionPersonalization')}>
        <SettingsRow
          icon="color-palette-outline"
          label={t('settings.appearance')}
          subtitle={t('settings.appearanceSubtitle')}
          onPress={() => router.push('/settings/appearance')}
        />
        <SettingsRow
          icon="shapes-outline"
          label={t('settings.markerCustomization')}
          subtitle={t('settings.markerCustomizationSubtitle')}
          onPress={() => router.push('/settings/marker-customization')}
        />
        <SettingsRow
          icon="language-outline"
          label={t('settings.language')}
          onPress={() => router.push('/settings/language')}
        />
        <SettingsRow
          icon="pulse-outline"
          label={t('settings.haptics')}
          onPress={() => router.push('/settings/haptics')}
        />
        <SettingsRow
          icon="notifications-outline"
          label={t('settings.notifications')}
          subtitle={t('settings.notificationsSubtitle')}
          onPress={() => requireAccount(() => router.push('/settings/notifications'))}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionData')}>
        <SettingsRow
          icon="sync-outline"
          label={t('settings.sync')}
          subtitle={t('settings.syncSubtitle')}
          onPress={() => requireAccount(() => router.push('/settings/sync'))}
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
      </View>

    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      paddingTop: topInset + Spacing.two,
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.three,
      gap: Spacing.two,
    },
    body: {
      // Everything below the title, centered vertically in the remaining space.
      flex: 1,
      justifyContent: 'center',
      gap: Spacing.two,
    },
    title: {
      color: t.accent,
      fontFamily: font,
      fontSize: FontSize.xl,
      letterSpacing: 1,
    },
  });
}

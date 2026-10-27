/**
 * Settings landing screen (mounted as the "Profile" tab — name kept for route
 * stability; the user-facing label is "Options"/"Settings" via t('tabs.profile')).
 *
 * Categorized list. Rich settings navigate to `src/app/settings/<id>.tsx`;
 * simple booleans (haptics, notifications) and the language picker live
 * inline right here.
 */
import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/theme-context";
import { useAuthStore, useRequireAccount } from "@/features/auth";
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from "@/constants/theme";
import { SettingsSection, SettingsRow, SettingsToggleRow, useHapticsStore, hapticTap } from "@/features/settings";
import { fetchMyNotificationPrefs, updateMyNotificationPrefs } from "@/features/notifications";
import { SUPPORTED_LANGUAGES, setLanguage } from "@/services/i18n";
import { StreetsBackground } from "@/components/StreetsBackground";
import { ArcadeTitle } from "@/components/ArcadeTitle";
import { PlayerCard } from "@/features/settings/components/PlayerCard";

export default function SettingsLanding() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isGuest = useAuthStore((s) => s.isGuest);
  const requireAccount = useRequireAccount();
  const styles = makeStyles(theme, insets.top);

  // Haptics — local store, instant
  const hapticsEnabled = useHapticsStore((s) => s.enabled);
  const setHapticsEnabled = useHapticsStore((s) => s.setEnabled);
  function handleHapticsToggle(v: boolean) {
    setHapticsEnabled(v);
    // Preview pulse on enable so the user feels what they just turned on.
    if (v) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }

  // Notifications — server-side preference (account only)
  const [notifLoading, setNotifLoading] = useState(!isGuest);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  useEffect(() => {
    if (isGuest) return;
    fetchMyNotificationPrefs()
      .then((prefs) => setNotifEnabled(prefs.notifications_enabled))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [isGuest]);
  async function handleNotifToggle(value: boolean) {
    if (isGuest) {
      requireAccount(() => {});
      return;
    }
    setNotifEnabled(value); // optimistic
    setNotifSaving(true);
    try {
      const prefs = await updateMyNotificationPrefs(value);
      setNotifEnabled(prefs.notifications_enabled);
    } catch {
      setNotifEnabled(!value); // revert on failure
    } finally {
      setNotifSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <StreetsBackground intensity="faint" />
      <ArcadeTitle text={t('settings.title')} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <PlayerCard />

      <SettingsSection title={t('settings.sectionAccount')}>
        {isGuest ? (
          <>
            <SettingsRow
              icon="person-add-outline"
              label={t('guest.createAccount')}
              subtitle={t('guest.createAccountSubtitle')}
              onPress={() => router.push('/register')}
            />
            <SettingsRow
              icon="log-in-outline"
              label={t('guest.login')}
              subtitle={t('guest.loginSubtitle')}
              onPress={() => router.push('/login')}
            />
          </>
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
          hideChevron
          rightAccessory={
            <View style={styles.langGroup}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = lang.code === i18n.language;
                return (
                  <Pressable
                    key={lang.code}
                    style={({ pressed }) => [
                      styles.langPill,
                      isActive && { borderColor: theme.accent },
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => { hapticTap(); setLanguage(lang.code); }}
                  >
                    <Text style={[styles.langPillText, isActive && { color: theme.accent }]}>
                      {lang.code.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          }
        />
        <SettingsToggleRow
          icon="pulse-outline"
          label={t('settings.haptics')}
          value={hapticsEnabled}
          onValueChange={handleHapticsToggle}
        />
        <SettingsToggleRow
          icon="notifications-outline"
          label={t('settings.notifications')}
          subtitle={t('settings.notificationsSubtitle')}
          value={isGuest ? false : notifEnabled}
          onValueChange={handleNotifToggle}
          loading={notifLoading && !isGuest}
          disabled={notifSaving}
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
      </SettingsSection>
      </ScrollView>

    </View>
  );
}

function makeStyles(t: ThemeTokens, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      paddingTop: topInset + Spacing.two,
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.three,
      gap: Spacing.two,
    },
    scroll: { flex: 1 },
    body: {
      // Everything below the title, centered vertically in the remaining space
      // (scrolls when it doesn't fit, e.g. small phones or big font scale).
      flexGrow: 1,
      justifyContent: 'center',
      gap: Spacing.two,
    },
    langGroup: {
      flexDirection: 'row',
      gap: Spacing.one,
    },
    langPill: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
      backgroundColor: t.bgElement,
    },
    langPillText: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
    },
  });
}

import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore, logoutUser } from "@/features/auth";
import { useInvaderStore } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";
import * as Updates from 'expo-updates';
import { type ThemeTokens, type ThemeName, themes, FontSize, ButtonFontSize, BorderRadius, Spacing, ButtonFont } from "@/constants/theme";
import { SUPPORTED_LANGUAGES, setLanguage, getDateLocale, type LanguageCode } from "@/services/i18n";
import { fetchVersionManifest, getCurrentVersion, isNewer, useAppUpdateStore } from "@/features/app-update";

export default function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const user   = useAuthStore((s) => s.user);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { theme, themeName, setTheme, appFont, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(theme, appFont, fontScale), [theme, appFont, fontScale]);
  const isSyncing   = useInvaderStore((s) => s.isSyncing);
  const requestSync = useInvaderStore((s) => s.requestSync);
  const currentLang = i18n.language;

  async function handleLogout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      try { await logoutUser(refreshToken); } catch {}
    }
    logout();
    router.replace('/login');
  }

  async function handleLanguageChange(code: LanguageCode) {
    await setLanguage(code);
  }

  async function handleCheckForUpdates() {
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

  const isOta   = !Updates.isEmbeddedLaunch;
  const otaDate = Updates.createdAt
    ? Updates.createdAt.toLocaleString(getDateLocale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const otaChannel = Updates.channel ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.versionBlock}>
        <Text style={styles.version}>
          {isOta && otaDate
            ? `${otaDate}${otaChannel ? ` · ${otaChannel}` : ""}`
            : t('profile.build')}
        </Text>
      </View>
      {user && (
        <Text style={styles.username}>{user.username}</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.theme')}</Text>
        <View style={styles.themeRow}>
          {(Object.keys(themes) as ThemeName[]).map((name) => {
            const isActive = name === themeName;
            return (
              <Pressable
                key={name}
                style={({ pressed }) => [
                  styles.themeOption,
                  isActive && styles.themeOptionActive,
                  pressed && styles.themeOptionPressed,
                ]}
                onPress={() => setTheme(name)}>
                <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>
                  {t(`themeNames.${name}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.language')}</Text>
        <View style={styles.themeRow}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isActive = lang.code === currentLang;
            return (
              <Pressable
                key={lang.code}
                style={({ pressed }) => [
                  styles.themeOption,
                  isActive && styles.themeOptionActive,
                  pressed && styles.themeOptionPressed,
                ]}
                onPress={() => handleLanguageChange(lang.code)}>
                <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>
                  {t(lang.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.syncButton, pressed && styles.buttonPressed]}
        onPress={requestSync}
        disabled={isSyncing}
      >
        <Text style={styles.syncButtonText}>{isSyncing ? t('profile.syncing') : t('profile.syncNow')}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.syncButton, pressed && styles.buttonPressed]}
        onPress={() => router.push('/flash-import')}>
        <Text style={styles.syncButtonText}>{t('profile.importFlashes')}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.syncButton, pressed && styles.buttonPressed]}
        onPress={handleCheckForUpdates}>
        <Text style={styles.syncButtonText}>{t('appUpdate.checkBtn')}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
        onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>{t('profile.disconnect')}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.four,
      padding: Spacing.five,
    },
    versionBlock: {
      position: 'absolute',
      bottom: Spacing.three,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    version: {
      color: t.textMuted,
      fontSize: 9,
      fontFamily: font,
      opacity: 0.6,
    },
    username: {
      color: t.accent,
      fontSize: sz(FontSize.xl),
      fontFamily: font,
      letterSpacing: 2,
    },
    section: {
      width: '100%',
      maxWidth: 360,
      gap: Spacing.two,
    },
    sectionLabel: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    themeRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    themeOption: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bgElement,
    },
    themeOptionActive: {
      borderColor: t.accent,
      backgroundColor: t.bgElement,
    },
    themeOptionPressed: {
      opacity: 0.7,
    },
    themeOptionText: {
      color: t.textMuted,
      fontSize: ButtonFontSize.xl,
      fontFamily: ButtonFont,
    },
    themeOptionTextActive: {
      color: t.accent,
      fontFamily: ButtonFont,
    },
    divider: {
      width: '100%',
      maxWidth: 360,
      height: 1,
      backgroundColor: t.bgDivider,
    },
    syncButton: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.five,
    },
    syncButtonText: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xxl,
    },
    logoutButton: {
      borderWidth: 1,
      borderColor: t.danger,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.five,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    logoutButtonText: {
      color: t.danger,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xxl,
    },
  });
}

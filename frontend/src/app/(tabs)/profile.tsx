import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore, logoutUser } from "@/features/auth";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, type ThemeName, themes, themeLabels, FontSize, BorderRadius, Spacing, ButtonFont } from "@/constants/theme";

export default function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const { theme, themeName, setTheme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  async function handleLogout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      try { await logoutUser(refreshToken); } catch {}
    }
    logout();
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Theme</Text>
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
                  {themeLabels[name]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
        onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Disconnect</Text>
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
      fontSize: FontSize.sm,
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
      fontSize: FontSize.md,
    },
  });
}

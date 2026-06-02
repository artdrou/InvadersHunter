/**
 * Common chrome for every settings sub-screen: back button, title, and a
 * scrollable content area. Keeps sub-screen files focused on their actual
 * setting controls.
 */
import { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  children: ReactNode;
};

export function SettingsShell({ title, children }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>{'< ' + t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {children}
      </ScrollView>
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    header: {
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.three,
      gap: Spacing.two,
    },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    backText: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.md,
    },
    title: {
      color: t.accent,
      fontFamily: font,
      fontSize: ButtonFontSize.xxl,
      letterSpacing: 1,
    },
    body: {
      // Center the content vertically in the space below the title; flexGrow lets it
      // grow to fill (so justifyContent centers) yet still scroll if it ever overflows.
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.six,
      gap: Spacing.three,
    },
    pressed: { opacity: 0.6 },
  });
}

// Re-export tokens commonly used inside sub-screens so they don't have to
// re-import them all individually.
export { BorderRadius, Spacing, ButtonFont, ButtonFontSize };

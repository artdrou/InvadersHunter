/**
 * Common chrome for every settings sub-screen: back button, title, and a
 * scrollable content area. Keeps sub-screen files focused on their actual
 * setting controls.
 */
import { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { StreetsBackground } from '@/components/StreetsBackground';
import { ArcadeTitle } from '@/components/ArcadeTitle';

type Props = {
  title: string;
  children: ReactNode;
  // When false, the body is a plain View instead of a ScrollView. Use it for
  // screens whose controls are designed to fit on one screen and that embed
  // their own scrollable/gesture regions (e.g. the marker shape carousels): a
  // wrapping same-axis ScrollView fights those child gestures on iOS, where
  // nestedScrollEnabled is a no-op. Content that overflows is clipped, so only
  // opt out when the layout genuinely fits.
  scrollable?: boolean;
};

export function SettingsShell({ title, children, scrollable = true }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  return (
    // Edge-to-edge Android no longer resizes the window for the keyboard: pad it ourselves
    // so a focused field stays above it.
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + Spacing.three }]} behavior="padding">
      <StreetsBackground intensity="faint" />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>{'< ' + t('common.back')}</Text>
        </Pressable>
        <ArcadeTitle text={title} />
      </View>
      {scrollable ? (
        <ScrollView contentContainerStyle={styles.body}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: ThemeTokens) {
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
      fontSize: FontSize.md,
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
export { BorderRadius, Spacing, ButtonFont, FontSize };

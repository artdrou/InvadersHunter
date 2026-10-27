/** Shared look of the app-update prompts (new APK, OTA ready to apply). */
import { StyleSheet } from 'react-native';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel } from '@/constants/arcade-button';

export function makeUpdateModalStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.four,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.lg,
      padding: Spacing.four,
      gap: Spacing.two,
    },
    title: {
      color: t.accent,
      fontSize: sz(FontSize.lg),
      fontFamily: font,
      letterSpacing: 1,
      marginBottom: Spacing.one,
    },
    body: {
      color: t.text,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      lineHeight: 20,
    },
    notes: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm) - 1,
      fontFamily: font,
      fontStyle: 'italic',
      marginTop: Spacing.one,
    },
    primaryBtn: {
      ...arcadeButton(t),
      borderRadius: BorderRadius.sm,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    primaryBtnText: {
      ...arcadeButtonLabel(t),
      fontSize: FontSize.xxl,
    },
    secondaryBtn: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xl,
    },
    pressed: { opacity: 0.7 },
  });
}

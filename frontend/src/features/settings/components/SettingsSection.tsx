/**
 * A grouped card of settings rows, with a small uppercase label on top.
 * Designed for the settings landing screen.
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';

type Props = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    section: { gap: Spacing.one },
    label: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
      paddingHorizontal: Spacing.two,
    },
    card: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
    },
  });
}

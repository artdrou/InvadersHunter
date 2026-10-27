/**
 * A grouped card of settings rows, with a section label on top: arcade style, the label
 * in the accent colour followed by a dotted line, the card outlined with a hard shadow.
 * Designed for the settings landing screen.
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFontBold, Spacing, FontSize } from '@/constants/theme';

type Props = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.label}>{title}</Text>
        <View style={styles.rule} />
      </View>
      <View style={styles.card}>
        {/* Rows draw their divider on top: the first one's is tucked under the card edge */}
        <View style={styles.rows}>{children}</View>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    section: { gap: Spacing.two },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.one,
      marginTop: Spacing.one,
    },
    label: {
      color: t.accent,
      fontFamily: ButtonFontBold,
      fontSize: FontSize.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    rule: {
      flex: 1,
      borderTopWidth: 2,
      borderTopColor: t.bgDivider,
      borderStyle: 'dotted',
    },
    card: {
      backgroundColor: t.bgElement,
      borderWidth: 2,
      borderColor: t.border,
      borderRadius: 6,
      overflow: 'hidden',
      boxShadow: `3px 3px 0px ${t.isLight ? t.border : 'rgba(0, 0, 0, 0.6)'}`,
    },
    rows: { marginTop: -2 },
  });
}

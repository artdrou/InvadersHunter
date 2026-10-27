/**
 * A grouped card of settings rows, with a section label on top: arcade style, the label
 * in the accent colour followed by a dotted line, the card outlined with a hard shadow.
 * Designed for the settings landing screen.
 */
import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, Spacing } from '@/constants/theme';
import { arcadeCard } from '@/constants/arcade-button';
import { ArcadeSectionLabel } from '@/components/ArcadeSectionLabel';

type Props = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <ArcadeSectionLabel title={title} />
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
    card: { ...arcadeCard(t), overflow: 'hidden' },
    rows: { marginTop: -2 },
  });
}

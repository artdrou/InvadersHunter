/**
 * Section label above a card, arcade style: accent bold capitals followed by a dotted rule.
 */
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { arcadeSectionLabel } from '@/constants/arcade-button';

type Props = {
  title: string;
  style?: StyleProp<ViewStyle>;
};

export function ArcadeSectionLabel({ title, style }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.header, style]}>
      <Text style={arcadeSectionLabel(theme)}>{title}</Text>
      <View style={[styles.rule, { borderTopColor: theme.bgDivider }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    marginTop: Spacing.one,
  },
  rule: { flex: 1, borderTopWidth: 2, borderStyle: 'dotted' },
});

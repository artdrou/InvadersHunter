/**
 * A single row inside a SettingsSection. Optionally:
 *  - leading icon
 *  - trailing value (e.g. "FR" next to Language)
 *  - destructive tint (e.g. Disconnect)
 *  - trailing chevron (default true; pass `hideChevron` for action rows)
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, Spacing, FontSize } from '@/constants/theme';
import { tap } from '../haptics';

type Props = {
  label: string;
  subtitle?: string;
  value?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  destructive?: boolean;
  hideChevron?: boolean;
  /** When set, renders a custom right-side element (e.g. a color swatch). */
  rightAccessory?: React.ReactNode;
};

export function SettingsRow({
  label, subtitle, value, icon, onPress, destructive, hideChevron, rightAccessory,
}: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const labelColor = destructive ? theme.danger : theme.text;
  const iconColor = destructive ? theme.danger : theme.accent;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      disabled={!onPress}
    >
      {icon && <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />}
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {value && <Text style={styles.value}>{value}</Text>}
      {rightAccessory}
      {!hideChevron && onPress && (
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      )}
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.bgDivider,
    },
    rowPressed: { opacity: 0.5 },
    icon: { width: 24, textAlign: 'center' },
    labelWrap: { flex: 1, gap: 2 },
    label: {
      fontFamily: ButtonFont,
      fontSize: FontSize.md,
    },
    subtitle: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
    },
    value: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.sm,
    },
  });
}

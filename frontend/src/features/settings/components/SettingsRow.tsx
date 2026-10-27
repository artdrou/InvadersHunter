/**
 * A single row inside a SettingsSection. Optionally:
 *  - leading icon (drawn filled, with the arcade shadow — pass the usual `*-outline` name)
 *  - trailing value (e.g. "FR" next to Language)
 *  - destructive tint (e.g. Disconnect)
 *  - trailing arrow (default true; pass `hideChevron` for action rows)
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, ButtonFontBold, Spacing, FontSize } from '@/constants/theme';
import { arcadeRowDivider, dangerShadowColor } from '@/constants/arcade-button';
import { ShadowIcon } from '@/components/ShadowIcon';
import { tap } from '../haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  destructive?: boolean;
  hideChevron?: boolean;
  /** When set, renders a custom right-side element (e.g. a color swatch). */
  rightAccessory?: React.ReactNode;
};

/** Leading icon of a settings row: the filled version of `icon`, with the arcade shadow. */
export function SettingsRowIcon({ icon, destructive }: { icon: IconName; destructive?: boolean }) {
  const { theme } = useTheme();
  const filled = icon.replace(/-outline$/, '') as IconName;
  return (
    <View style={rowIconStyle}>
      <ShadowIcon
        name={filled}
        size={20}
        color={destructive ? theme.danger : theme.accent}
        shadowColor={destructive ? dangerShadowColor(theme.danger) : theme.titleShadow}
      />
    </View>
  );
}

const rowIconStyle = { width: 26, alignItems: 'center' } as const;

export function SettingsRow({
  label, subtitle, value, icon, onPress, destructive, hideChevron, rightAccessory,
}: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const labelColor = destructive ? theme.danger : theme.text;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      disabled={!onPress}
    >
      {icon && <SettingsRowIcon icon={icon} destructive={destructive} />}
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {value && <Text style={styles.value}>{value}</Text>}
      {rightAccessory}
      {!hideChevron && onPress && (
        <Ionicons name="caret-forward" size={14} color={destructive ? theme.danger : theme.accent} />
      )}
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two + 2,
      ...arcadeRowDivider(t),
    },
    rowPressed: { opacity: 0.5 },
    labelWrap: { flex: 1, gap: 2 },
    label: {
      fontFamily: ButtonFontBold,
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

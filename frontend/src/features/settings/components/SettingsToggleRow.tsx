/**
 * A SettingsRow variant whose trailing control is an inline Switch —
 * for boolean settings that don't deserve a dedicated sub-screen.
 * Shows a spinner instead of the switch while `loading`.
 */
import { View, Text, Switch, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, Spacing, FontSize } from '@/constants/theme';

type Props = {
  label: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
};

export function SettingsToggleRow({ label, subtitle, icon, value, onValueChange, disabled, loading }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={20} color={theme.accent} style={styles.icon} />}
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.bgElement}
        />
      )}
    </View>
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
    icon: { width: 24, textAlign: 'center' },
    labelWrap: { flex: 1, gap: 2 },
    label: {
      color: t.text,
      fontFamily: ButtonFont,
      fontSize: FontSize.md,
    },
    subtitle: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
    },
  });
}

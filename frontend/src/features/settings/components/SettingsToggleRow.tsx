/**
 * A SettingsRow variant whose trailing control is an ON | OFF arcade switch —
 * for boolean settings that don't deserve a dedicated sub-screen.
 * Shows a spinner instead of the switch while `loading`.
 */
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, ButtonFontBold, Spacing, FontSize } from '@/constants/theme';
import { SettingsRowIcon } from './SettingsRow';
import { ArcadeSegmented } from './ArcadeSegmented';

type Props = {
  label: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
};

const ON_OFF = [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }];

export function SettingsToggleRow({ label, subtitle, icon, value, onValueChange, disabled, loading }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      {icon && <SettingsRowIcon icon={icon} />}
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <ArcadeSegmented options={ON_OFF} value={value} onChange={onValueChange} disabled={disabled} />
      )}
    </View>
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
      borderTopWidth: 2,
      borderTopColor: t.bgDivider,
      borderStyle: 'dotted',
    },
    labelWrap: { flex: 1, gap: 2 },
    label: {
      color: t.text,
      fontFamily: ButtonFontBold,
      fontSize: FontSize.md,
    },
    subtitle: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
    },
  });
}

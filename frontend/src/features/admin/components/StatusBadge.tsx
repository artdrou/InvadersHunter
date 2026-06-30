import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, BorderRadius, ButtonFont, ButtonFontSize, Spacing } from '@/constants/theme';

export type AdminRequestStatus = 'pending' | 'approved' | 'rejected';

const PENDING_COLOR = '#f0a500';

function statusColor(status: AdminRequestStatus, theme: ThemeTokens): string {
  if (status === 'approved') return theme.success;
  if (status === 'rejected') return theme.danger;
  return PENDING_COLOR;
}

export function StatusBadge({ status }: { status: AdminRequestStatus }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const color = statusColor(status, theme);
  const styles = makeStyles(color);
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>
        {t(`admin.status${status.charAt(0).toUpperCase()}${status.slice(1)}`)}
      </Text>
    </View>
  );
}

function makeStyles(color: string) {
  return StyleSheet.create({
    badge: {
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      paddingVertical: 3,
      backgroundColor: color + '33',
      borderWidth: 1,
      borderColor: color,
    },
    text: {
      color,
      fontSize: ButtonFontSize.xs,
      fontFamily: ButtonFont,
      letterSpacing: 0.5,
    },
  });
}

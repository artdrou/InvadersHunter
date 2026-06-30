import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, BorderRadius, ButtonFont, ButtonFontSize } from '@/constants/theme';

function confidenceColor(score: number, theme: ThemeTokens): string {
  if (score >= 75) return theme.success;
  if (score >= 45) return '#f0a500';
  return theme.danger;
}

export function ConfidenceBadge({ requestCount, confidence }: { requestCount: number; confidence: number }) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const notEnoughData = requestCount < 2;
  const color = notEnoughData ? theme.textMuted : confidenceColor(confidence, theme);
  const styles = makeStyles(color);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{notEnoughData ? t('admin.confidenceNA') : `${confidence}%`}</Text>
    </View>
  );
}

function makeStyles(color: string) {
  return StyleSheet.create({
    badge: {
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      minWidth: 38,
      alignItems: 'center',
      backgroundColor: color,
    },
    text: {
      color: '#fff',
      fontSize: ButtonFontSize.xs,
      fontFamily: ButtonFont,
    },
  });
}

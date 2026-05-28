import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';

// Items to show on the roadmap screen. Each `key` must match a sub-entry under
// `settings.roadmapItems.<key>` in the locale files (title + body).
const ROADMAP_ITEMS: { key: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'gamification',    icon: 'trophy-outline' },
  { key: 'guestMode',       icon: 'person-add-outline' },
  { key: 'friends',         icon: 'people-outline' },
  { key: 'commentWall',     icon: 'chatbubbles-outline' },
  { key: 'customInvaders',  icon: 'add-circle-outline' },
  { key: 'notifications',   icon: 'notifications-outline' },
  { key: 'radarMode',       icon: 'radio-outline' },
];

export default function RoadmapScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <SettingsShell title={t('settings.roadmap')}>
      <Text style={styles.intro}>{t('settings.roadmapIntro')}</Text>

      <View style={styles.list}>
        {ROADMAP_ITEMS.map((item) => (
          <View key={item.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name={item.icon} size={20} color={theme.accent} />
              <Text style={styles.cardTitle}>{t(`settings.roadmapItems.${item.key}.title`)}</Text>
            </View>
            <Text style={styles.cardBody}>{t(`settings.roadmapItems.${item.key}.body`)}</Text>
          </View>
        ))}
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    intro: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
      lineHeight: 22,
    },
    list: { gap: Spacing.two },
    card: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    cardTitle: {
      color: t.text,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.md,
      flexShrink: 1,
    },
    cardBody: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
      lineHeight: 20,
    },
  });
}

import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';

type RoadmapStatus = 'soon' | 'wip' | 'planned';

// Items to show on the roadmap screen. Each `key` must match a sub-entry under
// `settings.roadmapItems.<key>` in the locale files (title + body).
// Status: 'soon' = built, ships next release; 'wip' = in development;
// 'planned' = on the roadmap, not started.
const ROADMAP_ITEMS: { key: string; icon: React.ComponentProps<typeof Ionicons>['name']; status: RoadmapStatus }[] = [
  { key: 'guestMode',       icon: 'person-add-outline',  status: 'soon' },
  { key: 'customInvaders',  icon: 'add-circle-outline',  status: 'wip' },
  { key: 'friends',         icon: 'people-outline',      status: 'wip' },
  { key: 'commentWall',     icon: 'chatbubbles-outline', status: 'wip' },
  { key: 'discoveredBy',    icon: 'ribbon-outline',      status: 'wip' },
  { key: 'gamification',    icon: 'trophy-outline',      status: 'planned' },
  { key: 'radarMode',       icon: 'radio-outline',       status: 'planned' },
];

export default function RoadmapScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <SettingsShell title={t('settings.roadmap')}>
      <Text style={styles.intro}>{t('settings.roadmapIntro')}</Text>

      <View style={styles.list}>
        {ROADMAP_ITEMS.map((item) => (
          <View key={item.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name={item.icon} size={20} color={theme.accent} />
              <Text style={styles.cardTitle}>{t(`settings.roadmapItems.${item.key}.title`)}</Text>
              <View style={[styles.badge, styles[`badge_${item.status}`]]}>
                <Text style={[styles.badgeText, styles[`badgeText_${item.status}`]]}>
                  {t(`settings.roadmapStatus.${item.status}`)}
                </Text>
              </View>
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
      fontSize: FontSize.sm,
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
      fontSize: FontSize.md,
      flexShrink: 1,
    },
    badge: {
      marginLeft: 'auto',
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      paddingHorizontal: Spacing.two,
      paddingVertical: 2,
    },
    badge_soon:    { borderColor: t.accent,    backgroundColor: 'transparent' },
    badge_wip:     { borderColor: t.textMuted, backgroundColor: 'transparent' },
    badge_planned: { borderColor: t.border,    backgroundColor: 'transparent' },
    badgeText: {
      fontFamily: ButtonFont,
      fontSize: FontSize.xxs,
      letterSpacing: 0.5,
    },
    badgeText_soon:    { color: t.accent },
    badgeText_wip:     { color: t.textMuted },
    badgeText_planned: { color: t.textMuted },
    cardBody: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.sm,
      lineHeight: 20,
    },
  });
}

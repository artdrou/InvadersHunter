/**
 * Stat cards used by profile screens (the user's own profile and the admin
 * user page): a titled section, a 2-column grid of value cells, and a
 * full-width text cell. Type sizes match the settings rows/sections
 * (SettingsSection / SettingsRow) so these screens read like the rest of the app.
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import type { CollectionStats } from '@/features/invaders/utils/collection-stats';

/** The "Collection" section (flashed, cities, remaining…) shared by every profile screen. */
export function CollectionStatsSection({ stats }: { stats: CollectionStats }) {
  const { t } = useTranslation();
  return (
    <StatSection title={t('settings.statsCollection')}>
      <StatCell label={t('settings.statsInvadersFlashed')} value={stats.flashed} />
      <StatCell label={t('settings.statsCitiesWithFlashes')} value={stats.citiesWithFlashes} />
      <StatCell label={t('settings.statsCompleteCities')} value={stats.completeCities} />
      <StatCell label={t('settings.statsRemaining')} value={stats.remaining} />
      <StatCell label={t('settings.statsDestroyedFlashed')} value={stats.destroyedFlashed} />
      <StatCell
        label={t('settings.statsTopCity')}
        value={stats.topCity?.name ?? t('settings.statsNone')}
        sub={stats.topCity ? `${stats.topCity.captured}/${stats.topCity.total}` : undefined}
      />
    </StatSection>
  );
}

/** Section title + its cells (a 2-column grid unless `grid={false}`). */
export function StatSection({ title, children, grid = true }: { title: string; children: ReactNode; grid?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {grid ? <View style={styles.grid}>{children}</View> : children}
    </View>
  );
}

/** Big number (or short text) with an optional sub-value and a caption. */
export function StatCell({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.cell}>
      <Text style={styles.cellValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.cellSub}>{sub}</Text> : null}
      <Text style={styles.cellLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/** Full-width cell for a single text value (username, email…), with an optional caption. */
export function InfoCell({ value, label }: { value: string; label?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.cellFull}>
      <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {label ? <Text style={styles.cellLabel}>{label}</Text> : null}
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    section: { gap: Spacing.one },
    sectionLabel: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs,
      letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: Spacing.two,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
    },
    cell: {
      // 2-column grid: each cell takes ~half the row width minus the gap.
      flexBasis: '48%',
      flexGrow: 1,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      gap: 2,
    },
    cellFull: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      gap: 2,
    },
    cellValue: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: FontSize.md,
    },
    cellSub: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
    },
    cellLabel: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
    },
  });
}

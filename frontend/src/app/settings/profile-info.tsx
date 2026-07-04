import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuthStore, logoutUser } from '@/features/auth';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';
import { useInvaderData, mapInvadersWithProgress, cityOf, isNonFlashable } from '@/features/invaders';

export default function ProfileInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const db = useSQLiteContext();
  const { invaders, progress } = useInvaderData();

  // user_requests live in local SQLite (per-user). Pull aggregate counts once
  // per mount; the table is rebuilt on every delta sync so it stays current.
  const [editsSent, setEditsSent] = useState(0);
  const [editsAccepted, setEditsAccepted] = useState(0);
  const userId = user?.id;
  useEffect(() => {
    if (userId == null) return;
    db.getAllAsync<{ status: string }>(
      'SELECT status FROM user_requests WHERE user_id = ?',
      [userId],
    ).then((rows) => {
      setEditsSent(rows.length);
      setEditsAccepted(rows.filter((r) => r.status === 'approved').length);
    }).catch(() => {});
  }, [userId, db]);

  const stats = useMemo(() => {
    const withState = mapInvadersWithProgress(invaders, progress);
    const captured = withState.filter((i) => i.isCaptured);

    // City breakdown — total invaders per city + captured per city.
    const byCity = new Map<string, { captured: number; total: number }>();
    for (const inv of withState) {
      const c = cityOf(inv.name);
      const e = byCity.get(c) ?? { captured: 0, total: 0 };
      e.total++;
      if (inv.isCaptured) e.captured++;
      byCity.set(c, e);
    }

    const completeCities = [...byCity.values()].filter(
      (c) => c.total > 0 && c.captured === c.total,
    ).length;

    // "Top city": city with the highest absolute count of captured invaders.
    let topCity: { name: string; captured: number; total: number } | null = null;
    for (const [name, c] of byCity) {
      if (c.captured === 0) continue;
      if (!topCity || c.captured > topCity.captured) {
        topCity = { name, captured: c.captured, total: c.total };
      }
    }

    const destroyedFlashed = captured.filter((i) => (i.state ?? '').toLowerCase() === 'destroyed').length;
    const remaining = withState.filter((i) => !i.isCaptured && !isNonFlashable(i.state)).length;
    const citiesWithFlashes = new Set(captured.map((i) => cityOf(i.name))).size;

    return {
      flashed: captured.length,
      citiesWithFlashes,
      completeCities,
      destroyedFlashed,
      remaining,
      topCity,
    };
  }, [invaders, progress]);

  async function handleLogout() {
    hapticTap();
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      try { await logoutUser(refreshToken); } catch {}
    }
    logout();
    router.replace('/login');
  }

  return (
    <SettingsShell title={t('settings.profileInfo')}>
      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('auth.username')}</Text>
          <View style={styles.cellFull}>
            <Text style={styles.cellValue} numberOfLines={1}>{user.username}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.statsCollection')}</Text>
        <View style={styles.grid}>
          <StatCell label={t('settings.statsInvadersFlashed')} value={stats.flashed} styles={styles} />
          <StatCell label={t('settings.statsCitiesWithFlashes')} value={stats.citiesWithFlashes} styles={styles} />
          <StatCell label={t('settings.statsCompleteCities')} value={stats.completeCities} styles={styles} />
          <StatCell label={t('settings.statsRemaining')} value={stats.remaining} styles={styles} />
          <StatCell label={t('settings.statsDestroyedFlashed')} value={stats.destroyedFlashed} styles={styles} />
          <StatCell
            label={t('settings.statsTopCity')}
            value={stats.topCity?.name ?? t('settings.statsNone')}
            sub={stats.topCity ? `${stats.topCity.captured}/${stats.topCity.total}` : undefined}
            styles={styles}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.statsContributions')}</Text>
        <View style={styles.grid}>
          <StatCell label={t('settings.statsModificationsSent')} value={editsSent} styles={styles} />
          <StatCell label={t('settings.statsModificationsAccepted')} value={editsAccepted} styles={styles} />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>{t('settings.disconnect')}</Text>
      </Pressable>
    </SettingsShell>
  );
}

// ─── Internal: single stat cell. Kept local since this is the only screen
// that uses it. Promote to features/settings if reused elsewhere later.
function StatCell({
  label,
  value,
  sub,
  styles,
}: {
  label: string;
  value: string | number;
  sub?: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.cellSub}>{sub}</Text> : null}
      <Text style={styles.cellLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    cellFull: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
      gap: 2,
    },
    section: { gap: Spacing.two },
    sectionLabel: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.sm,
      letterSpacing: 1, textTransform: 'uppercase',
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
      padding: Spacing.three,
      gap: 2,
    },
    cellValue: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: FontSize.xxl,
    },
    cellSub: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.sm,
    },
    cellLabel: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
      marginTop: Spacing.one,
      letterSpacing: 0.5,
    },
    logoutBtn: {
      paddingVertical: 14,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.danger,
      alignItems: 'center',
      marginTop: Spacing.three,
    },
    logoutText: { color: t.danger, fontFamily: ButtonFont, fontSize: FontSize.lg },
    pressed: { opacity: 0.6 },
  });
}

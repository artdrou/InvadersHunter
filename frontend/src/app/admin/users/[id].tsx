import { useCallback, useMemo, useState } from 'react';
import { Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { FontSize, Spacing } from '@/constants/theme';
import { SettingsShell, StatSection, StatCell, InfoCell } from '@/features/settings';
import { computeCollectionStats } from '@/features/invaders';
import { useInvaderStore } from '@/features/invaders/store';
import { fetchUserProfile } from '@/features/admin/services/admin.api';
import { formatServerDate } from '@/features/admin/utils';
import type { AdminUserProfile } from '@/features/admin/types';
import { UserAdminActions } from '@/features/admin/components/UserAdminActions';

/**
 * Admin view of any user: same collection stats cards as the user's own profile
 * (computed from their flashed invader ids against the local invader list),
 * plus email, account details, key dates and contributions, and the admin
 * actions (promote / demote, delete).
 */
export default function AdminUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const invaders = useInvaderStore((s) => s.invaders);

  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetchUserProfile(Number(id)).then(setProfile).catch(() => setError(true));
  }, [id]);
  useFocusEffect(load);

  const stats = useMemo(
    () => computeCollectionStats(invaders, new Set(profile?.flashed_invader_ids ?? [])),
    [invaders, profile],
  );

  const message = { color: theme.textMuted, fontFamily: appFont, fontSize: Math.round(FontSize.sm * fontScale) };

  if (!profile) {
    return (
      <SettingsShell title={t('adminUsers.profileTitle')}>
        {error ? (
          <Pressable onPress={load}>
            <Text style={[message, styles.centerText]}>{t('adminUsers.loadFailed')}</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </SettingsShell>
    );
  }

  const yes = t('adminUsers.yes');
  const no = t('adminUsers.no');

  return (
    <SettingsShell title={profile.username}>
      <StatSection title={t('adminUsers.sectionAccount')} grid={false}>
        <InfoCell value={profile.email} label={t('adminUsers.email')} />
      </StatSection>
      <StatSection title={t('adminUsers.sectionDetails')}>
        <StatCell label={t('adminUsers.role')} value={profile.is_admin ? t('adminUsers.roleAdmin') : t('adminUsers.roleUser')} />
        <StatCell label={t('adminUsers.userId')} value={`#${profile.id}`} />
        <StatCell label={t('adminUsers.language')} value={profile.language.toUpperCase()} />
        <StatCell label={t('adminUsers.notifications')} value={profile.notifications_enabled ? yes : no} />
      </StatSection>

      <StatSection title={t('adminUsers.sectionDates')} grid={false}>
        <InfoCell value={formatServerDate(profile.created_at)} label={t('adminUsers.dateJoined')} />
        <InfoCell value={formatServerDate(profile.last_login_at, true)} label={t('adminUsers.dateLastLogin')} />
        <InfoCell value={formatServerDate(profile.first_flash_at)} label={t('adminUsers.dateFirstFlash')} />
        <InfoCell value={formatServerDate(profile.last_flash_at, true)} label={t('adminUsers.dateLastFlash')} />
        <InfoCell value={formatServerDate(profile.last_request_at, true)} label={t('adminUsers.dateLastRequest')} />
      </StatSection>

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

      <StatSection title={t('settings.statsContributions')}>
        <StatCell label={t('settings.statsModificationsSent')} value={profile.requests_sent} />
        <StatCell label={t('settings.statsModificationsAccepted')} value={profile.requests_accepted} />
        <StatCell label={t('adminUsers.requestsRejected')} value={profile.requests_rejected} />
        <StatCell label={t('adminUsers.requestsPending')} value={profile.requests_pending} />
        <StatCell label={t('adminUsers.comments')} value={profile.comments} />
      </StatSection>

      <StatSection title={t('adminUsers.sectionActions')} grid={false}>
        <UserAdminActions profile={profile} onChanged={load} onDeleted={() => router.back()} />
      </StatSection>
    </SettingsShell>
  );
}

const styles = StyleSheet.create({
  centerText: { textAlign: 'center', marginTop: Spacing.five },
});

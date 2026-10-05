import { useCallback, useMemo, useState } from 'react';
import { Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { FontSize, Spacing, BorderRadius, ButtonFont } from '@/constants/theme';
import { SettingsShell, StatSection, StatCell, InfoCell, CollectionStatsSection, hapticTap } from '@/features/settings';
import { computeCollectionStats } from '@/features/invaders';
import { useInvaderStore } from '@/features/invaders/store';
import { formatServerDate } from '@/features/admin/utils';
import { fetchFriendProfile, removeFriendship, useFriendsStore } from '@/features/friends';
import type { FriendProfile } from '@/features/friends';

/**
 * A friend's profile: the same collection stats as your own profile (computed
 * from their flashed invader ids against the local invader list), key dates
 * and contributions — no private account details, no admin actions.
 */
export default function FriendProfileScreen() {
  const { id, friendshipId } = useLocalSearchParams<{ id: string; friendshipId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const invaders = useInvaderStore((s) => s.invaders);
  const reloadFriends = useFriendsStore((s) => s.load);

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [error, setError] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetchFriendProfile(Number(id)).then(setProfile).catch(() => setError(true));
  }, [id]);
  useFocusEffect(load);

  const stats = useMemo(
    () => computeCollectionStats(invaders, new Set(profile?.flashed_invader_ids ?? [])),
    [invaders, profile],
  );

  const message = { color: theme.textMuted, fontFamily: appFont, fontSize: Math.round(FontSize.sm * fontScale) };

  if (!profile) {
    return (
      <SettingsShell title={t('social.profileTitle')}>
        {error ? (
          <Pressable onPress={load}>
            <Text style={[message, styles.centerText]}>{t('social.loadFailed')}</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </SettingsShell>
    );
  }

  function confirmRemove() {
    if (!friendshipId || !profile) return;
    hapticTap();
    Alert.alert(
      t('social.removeFriend'),
      t('social.removeConfirm', { username: profile.username }),
      [
        { text: t('social.cancel'), style: 'cancel' },
        {
          text: t('social.removeFriend'),
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeFriendship(Number(friendshipId));
              // Don't leave the map showing an ex-friend's flashes.
              const { mapView, setMapView } = useFriendsStore.getState();
              if (mapView?.userId === profile.id) setMapView(null);
              await reloadFriends();
              router.back();
            } catch {
              setRemoving(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SettingsShell title={profile.username}>
      <StatSection title={t('adminUsers.sectionDates')} grid={false}>
        <InfoCell value={formatServerDate(profile.created_at)} label={t('adminUsers.dateJoined')} />
        <InfoCell value={formatServerDate(profile.first_flash_at)} label={t('adminUsers.dateFirstFlash')} />
        <InfoCell value={formatServerDate(profile.last_flash_at, true)} label={t('adminUsers.dateLastFlash')} />
      </StatSection>

      <CollectionStatsSection stats={stats} />

      <StatSection title={t('settings.statsContributions')}>
        <StatCell label={t('settings.statsModificationsSent')} value={profile.requests_sent} />
        <StatCell label={t('settings.statsModificationsAccepted')} value={profile.requests_accepted} />
        <StatCell label={t('adminUsers.comments')} value={profile.comments} />
      </StatSection>

      {friendshipId ? (
        <Pressable
          style={({ pressed }) => [styles.removeBtn, { borderColor: theme.danger }, pressed && styles.pressed]}
          onPress={confirmRemove}
          disabled={removing}
        >
          {removing
            ? <ActivityIndicator color={theme.danger} />
            : <Text style={[styles.removeText, { color: theme.danger }]}>{t('social.removeFriend')}</Text>}
        </Pressable>
      ) : null}
    </SettingsShell>
  );
}

const styles = StyleSheet.create({
  centerText: { textAlign: 'center', marginTop: Spacing.five },
  removeBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  removeText: { fontFamily: ButtonFont, fontSize: FontSize.md },
  pressed: { opacity: 0.6 },
});

import { useEffect, useMemo, useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuthStore, logoutUser } from '@/features/auth';
import { EditableUsername } from '@/features/auth/components/EditableUsername';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, StatSection, StatCell, CollectionStatsSection, hapticTap } from '@/features/settings';
import { useInvaderData, computeCollectionStats } from '@/features/invaders';
import { unregisterPushToken, useNotificationsStore } from '@/features/notifications';

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
      // The backend marks a submission "processed" once its admin request is approved
      // (rejected ones become "rejected"); there is no "approved" submission status.
      setEditsAccepted(rows.filter((r) => r.status === 'processed').length);
    }).catch(() => {});
  }, [userId, db]);

  const stats = useMemo(
    () => computeCollectionStats(invaders, new Set(progress.map((p) => p.invader_id))),
    [invaders, progress],
  );

  async function handleLogout() {
    hapticTap();
    const pushToken = useNotificationsStore.getState().currentToken;
    if (pushToken) {
      try { await unregisterPushToken(pushToken); } catch {}
      useNotificationsStore.getState().setCurrentToken(null);
    }
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
        <StatSection title={t('auth.username')} grid={false}>
          <EditableUsername />
        </StatSection>
      )}

      <CollectionStatsSection stats={stats} />

      <StatSection title={t('settings.statsContributions')}>
        <StatCell label={t('settings.statsModificationsSent')} value={editsSent} />
        <StatCell label={t('settings.statsModificationsAccepted')} value={editsAccepted} />
      </StatSection>

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>{t('settings.disconnect')}</Text>
      </Pressable>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    logoutBtn: {
      paddingVertical: 14,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.danger,
      alignItems: 'center',
      marginTop: Spacing.three,
    },
    logoutText: { color: t.danger, fontFamily: ButtonFont, fontSize: FontSize.md },
    pressed: { opacity: 0.6 },
  });
}

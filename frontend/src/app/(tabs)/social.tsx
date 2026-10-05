import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { useAuthStore, useRequireAccount } from '@/features/auth';
import { hapticTap, hapticSuccess } from '@/features/settings';
import {
  useFriendsStore, useUsernameLookup, sendFriendRequest, acceptFriendRequest, removeFriendship, friendRequestError,
} from '@/features/friends';
import type { FriendEntry, FriendLookup } from '@/features/friends';

type Feedback = { ok: boolean; text: string } | null;

/** Social tab: add a friend by username, answer invites, list friends. */
export default function SocialScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, appFont, fontScale), [theme, appFont, fontScale]);
  const isGuest = useAuthStore((s) => s.isGuest);
  const requireAccount = useRequireAccount();

  const overview = useFriendsStore((s) => s.overview);
  const loaded = useFriendsStore((s) => s.loaded);
  const load = useFriendsStore((s) => s.load);

  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState('');
  // The user picked from the suggestion — Send only works on a confirmed name.
  const [confirmed, setConfirmed] = useState<FriendLookup | null>(null);
  const lookup = useUsernameLookup(username, !isGuest && confirmed === null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Friendship id of the row whose button is busy (accept / decline / cancel).
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoadFailed(!(await load()));
  }, [load]);

  useFocusEffect(useCallback(() => { if (!isGuest) refresh(); }, [isGuest, refresh]));

  async function onPullRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function onTypeUsername(v: string) {
    setUsername(v);
    setConfirmed(null);
    setFeedback(null);
  }

  // Tapping the suggestion fixes the capitals, closes it and unlocks Send.
  function pickSuggestion(match: FriendLookup) {
    hapticTap();
    setUsername(match.username);
    setConfirmed(match);
  }

  async function send() {
    if (!confirmed || sending) return;
    const name = confirmed.username;
    hapticTap();
    setSending(true);
    setFeedback(null);
    try {
      const res = await sendFriendRequest(name);
      hapticSuccess();
      setUsername('');
      setConfirmed(null);
      setFeedback({
        ok: true,
        text: res.accepted ? t('social.acceptedNow', { username: name }) : t('social.sent', { username: name }),
      });
      refresh();
    } catch (err) {
      setFeedback({ ok: false, text: t(`social.error.${friendRequestError(err)}`) });
    } finally {
      setSending(false);
    }
  }

  async function act(entry: FriendEntry, action: 'accept' | 'remove') {
    hapticTap();
    setBusyId(entry.id);
    try {
      if (action === 'accept') {
        await acceptFriendRequest(entry.id);
        hapticSuccess();
      } else {
        await removeFriendship(entry.id);
      }
    } catch {
      // stale invite (already answered elsewhere) — the refresh below shows the truth
    }
    await refresh();
    setBusyId(null);
  }

  if (isGuest) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + Spacing.three }]}>
        <Ionicons name="people" size={48} color={theme.accent} />
        <Text style={styles.guestText}>{t('social.guestMessage')}</Text>
        <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => requireAccount(() => {})}>
          <Text style={styles.primaryBtnText}>{t('social.guestButton')}</Text>
        </Pressable>
      </View>
    );
  }

  function smallButton(entry: FriendEntry, label: string, onPress: () => void, primary = false) {
    return (
      <Pressable
        style={({ pressed }) => [styles.smallBtn, primary && styles.smallBtnPrimary, pressed && styles.pressed]}
        onPress={onPress}
        disabled={busyId !== null}
      >
        <Text style={[styles.smallBtnText, primary && styles.smallBtnTextPrimary]}>{label}</Text>
      </Pressable>
    );
  }

  function avatar(name: string) {
    return (
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <Text style={styles.title}>{t('social.title')}</Text>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.five }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.accent} />}
      >
        {/* ── Add a friend ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('social.addTitle')}</Text>
          <View style={styles.addRow}>
            <View style={[styles.inputWrap, confirmed && { borderColor: theme.success }]}>
              <TextInput
                value={username}
                onChangeText={onTypeUsername}
                placeholder={t('social.addPlaceholder')}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={send}
                style={styles.input}
              />
              {confirmed ? <Ionicons name="checkmark-circle" size={18} color={theme.success} /> : null}
              {lookup.status === 'checking' ? <ActivityIndicator size="small" color={theme.textMuted} /> : null}
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, styles.sendBtn, (!confirmed || sending) && styles.disabled, pressed && styles.pressed]}
              onPress={send}
              disabled={!confirmed || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={theme.bg} />
                : <Text style={styles.primaryBtnText}>{t('social.addButton')}</Text>}
            </Pressable>
          </View>
          {lookup.status === 'found' ? (() => {
            const { match } = lookup;
            const selectable = match.relation === 'none' || match.relation === 'received';
            return (
              <Pressable
                style={({ pressed }) => [styles.card, styles.suggestion, !selectable && styles.disabled, pressed && selectable && styles.pressed]}
                onPress={() => pickSuggestion(match)}
                disabled={!selectable}
              >
                {avatar(match.username)}
                <View style={styles.cardBody}>
                  <Text style={styles.username} numberOfLines={1}>{match.username}</Text>
                  <Text style={styles.meta}>{t(`social.relation.${match.relation}`)}</Text>
                </View>
                {selectable ? <Ionicons name="add-circle-outline" size={22} color={theme.accent} /> : null}
              </Pressable>
            );
          })() : null}
          {lookup.status === 'not_found' ? (
            <Text style={[styles.feedback, { color: theme.textMuted }]}>{t('social.error.user_not_found')}</Text>
          ) : null}
          {feedback ? (
            <Text style={[styles.feedback, { color: feedback.ok ? theme.success : theme.danger }]}>{feedback.text}</Text>
          ) : null}
        </View>

        {!loaded ? (
          loadFailed ? (
            <Pressable onPress={refresh}>
              <Text style={styles.muted}>{t('social.loadFailed')}</Text>
            </Pressable>
          ) : (
            <ActivityIndicator color={theme.accent} />
          )
        ) : (
          <>
            {/* ── Invites received ── */}
            {overview.incoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('social.incoming', { count: overview.incoming.length })}</Text>
                {overview.incoming.map((e) => (
                  <View key={e.id} style={styles.card}>
                    {avatar(e.username)}
                    <View style={styles.cardBody}>
                      <Text style={styles.username} numberOfLines={1}>{e.username}</Text>
                    </View>
                    {busyId === e.id ?<ActivityIndicator color={theme.accent} /> : (
                      <>
                        {smallButton(e, t('social.decline'), () => act(e, 'remove'))}
                        {smallButton(e, t('social.accept'), () => act(e, 'accept'), true)}
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* ── Invites sent ── */}
            {overview.outgoing.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('social.outgoing')}</Text>
                {overview.outgoing.map((e) => (
                  <View key={e.id} style={styles.card}>
                    {avatar(e.username)}
                    <View style={styles.cardBody}>
                      <Text style={styles.username} numberOfLines={1}>{e.username}</Text>
                      <Text style={styles.meta}>{t('social.pending')}</Text>
                    </View>
                    {busyId === e.id
                      ? <ActivityIndicator color={theme.accent} />
                      : smallButton(e, t('social.cancel'), () => act(e, 'remove'))}
                  </View>
                ))}
              </View>
            )}

            {/* ── Friends ── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('social.friends', { count: overview.friends.length })}</Text>
              {overview.friends.length === 0 ? (
                <Text style={styles.muted}>{t('social.noFriends')}</Text>
              ) : overview.friends.map((e) => (
                <Pressable
                  key={e.id}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: '/friends/[id]', params: { id: String(e.user_id), friendshipId: String(e.id) } })}
                >
                  {avatar(e.username)}
                  <View style={styles.cardBody}>
                    <Text style={styles.username} numberOfLines={1}>{e.username}</Text>
                    <Text style={styles.meta}>{t('social.flashedCount', { count: e.flashed_count })}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, fontScale: number) {
  const sz = (n: number) => Math.round(n * fontScale);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.five },
    title: {
      color: t.accent, fontFamily: font, fontSize: sz(FontSize.xl), letterSpacing: 1,
      paddingHorizontal: Spacing.four, paddingBottom: Spacing.two,
    },
    body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.four },
    section: { gap: Spacing.two },
    sectionLabel: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs,
      letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: Spacing.two,
    },
    addRow: { flexDirection: 'row', gap: Spacing.two },
    inputWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.three,
    },
    input: { flex: 1, color: t.text, fontFamily: font, fontSize: sz(FontSize.sm), paddingVertical: 10 },
    suggestion: { borderColor: t.accent },
    primaryBtn: {
      backgroundColor: t.accent, borderRadius: BorderRadius.sm,
      paddingVertical: 10, paddingHorizontal: Spacing.four, alignItems: 'center', justifyContent: 'center',
    },
    sendBtn: { minWidth: 90 },
    primaryBtnText: { color: t.bg, fontFamily: ButtonFont, fontSize: FontSize.md },
    feedback: { fontFamily: font, fontSize: sz(FontSize.xs), paddingHorizontal: Spacing.two },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
      padding: Spacing.three,
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.md,
    },
    avatar: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: t.accent,
    },
    avatarText: { color: t.accent, fontFamily: ButtonFont, fontSize: FontSize.lg },
    cardBody: { flex: 1, gap: 2 },
    username: { color: t.text, fontFamily: font, fontSize: sz(FontSize.md) },
    meta: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    smallBtn: {
      borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      paddingVertical: 6, paddingHorizontal: Spacing.two,
    },
    smallBtnPrimary: { backgroundColor: t.accent, borderColor: t.accent },
    smallBtnText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm },
    smallBtnTextPrimary: { color: t.bg },
    muted: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm), textAlign: 'center', paddingVertical: Spacing.three },
    guestText: { color: t.text, fontFamily: font, fontSize: sz(FontSize.md), textAlign: 'center' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
  });
}

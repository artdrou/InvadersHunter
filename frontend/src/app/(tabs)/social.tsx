import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { StreetsBackground } from '@/components/StreetsBackground';
import { ArcadeTitle } from '@/components/ArcadeTitle';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontBold } from '@/constants/theme';
import { useAuthStore, useRequireAccount } from '@/features/auth';
import { hapticTap, hapticSuccess } from '@/features/settings';
import { SettingsRowIcon } from '@/features/settings/components/SettingsRow';
import {
  useFriendsStore, useUsernameLookup, sendFriendRequest, acceptFriendRequest, removeFriendship, friendRequestError,
  MyFriendCodeCard,
} from '@/features/friends';
import type { FriendEntry, FriendLookup } from '@/features/friends';
import { useInvaderStore } from '@/features/invaders';
import { missingFields } from '@/features/invaders/edit-fields';
import { ISS_INVADER_NAME } from '@/features/iss/constants';
import { arcadeButton, arcadeButtonLabel, arcadeCard, arcadeLabelColor } from '@/constants/arcade-button';
import { ArcadeSectionLabel } from '@/components/ArcadeSectionLabel';
import { ShadowText } from '@/components/ShadowText';
import { PlayerAvatar } from '@/features/avatar';

type Feedback = { ok: boolean; text: string } | null;

/** Social tab: my friend code, add a friend by code or username, answer invites, list friends. */
export default function SocialScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, appFont, fontScale), [theme, appFont, fontScale]);
  const isGuest = useAuthStore((s) => s.isGuest);
  const requireAccount = useRequireAccount();

  // Community: invaders with missing details, completed by the players
  const allInvaders = useInvaderStore((s) => s.invaders);
  const incompleteCount = useMemo(
    () => allInvaders.filter((i) => i.name !== ISS_INVADER_NAME && missingFields(i).size > 0).length,
    [allInvaders],
  );

  const overview = useFriendsStore((s) => s.overview);
  const loaded = useFriendsStore((s) => s.loaded);
  const load = useFriendsStore((s) => s.load);
  const pendingCode = useFriendsStore((s) => s.pendingCode);
  const setPendingCode = useFriendsStore((s) => s.setPendingCode);

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

  // Opened from a friend link (app/f/[code]): the code goes in the field, the lookup
  // below then shows who it is
  useEffect(() => {
    if (!pendingCode || isGuest) return;
    onTypeUsername(pendingCode);
    setPendingCode(null);
  }, [pendingCode, isGuest, setPendingCode]);

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
        {primary
          ? <Text style={[styles.smallBtnText, styles.smallBtnTextPrimary]}>{label}</Text>
          : <ShadowText shadowColor={theme.titleShadow} style={styles.smallBtnText}>{label}</ShadowText>}
      </Pressable>
    );
  }

  function avatar(who: FriendEntry | FriendLookup) {
    return <PlayerAvatar avatar={who.avatar} size={36} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <StreetsBackground intensity="faint" />
      <ArcadeTitle text={t('social.title')} style={styles.title} />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.five }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.accent} />}
      >
        {/* ── Community: complete the catalogue ── */}
        <View style={styles.section}>
          <ArcadeSectionLabel title={t('social.communityTitle')} />
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => { hapticTap(); router.push('/incomplete'); }}
          >
            <SettingsRowIcon icon="construct-outline" />
            <View style={styles.cardBody}>
              <Text style={styles.username}>{t('incomplete.title')}</Text>
              <Text style={styles.meta}>{t('social.incompleteSub', { count: incompleteCount })}</Text>
            </View>
            <Ionicons name="caret-forward" size={14} color={theme.accent} />
          </Pressable>
        </View>

        {/* ── Add a friend ── */}
        <View style={styles.section}>
          <ArcadeSectionLabel title={t('social.addTitle')} />
          <MyFriendCodeCard />
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
                ? <ActivityIndicator size="small" color={arcadeLabelColor(theme)} />
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
                {avatar(match)}
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
                <ArcadeSectionLabel title={t('social.incoming', { count: overview.incoming.length })} />
                {overview.incoming.map((e) => (
                  <View key={e.id} style={styles.card}>
                    {avatar(e)}
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
                <ArcadeSectionLabel title={t('social.outgoing')} />
                {overview.outgoing.map((e) => (
                  <View key={e.id} style={styles.card}>
                    {avatar(e)}
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
              <ArcadeSectionLabel title={t('social.friends', { count: overview.friends.length })} />
              {overview.friends.length === 0 ? (
                <Text style={styles.muted}>{t('social.noFriends')}</Text>
              ) : overview.friends.map((e) => (
                <Pressable
                  key={e.id}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: '/friends/[id]', params: { id: String(e.user_id), friendshipId: String(e.id) } })}
                >
                  {avatar(e)}
                  <View style={styles.cardBody}>
                    <Text style={styles.username} numberOfLines={1}>{e.username}</Text>
                    <Text style={styles.meta}>{t('social.flashedCount', { count: e.flashed_count })}</Text>
                  </View>
                  <Ionicons name="caret-forward" size={14} color={theme.accent} />
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
    title: { marginHorizontal: Spacing.four, marginBottom: Spacing.two },
    body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.four },
    section: { gap: Spacing.two },
    addRow: { flexDirection: 'row', gap: Spacing.two },
    inputWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.three,
    },
    input: { flex: 1, color: t.text, fontFamily: font, fontSize: sz(FontSize.sm), paddingVertical: 10 },
    suggestion: { borderColor: t.accent },
    primaryBtn: {
      ...arcadeButton(t), borderRadius: BorderRadius.sm,
      paddingVertical: 10, paddingHorizontal: Spacing.four, alignItems: 'center', justifyContent: 'center',
    },
    sendBtn: { minWidth: 90 },
    primaryBtnText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
    feedback: { fontFamily: font, fontSize: sz(FontSize.xs), paddingHorizontal: Spacing.two },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
      padding: Spacing.three,
      ...arcadeCard(t),
    },
    cardBody: { flex: 1, gap: 2 },
    username: { color: t.text, fontFamily: ButtonFontBold, fontSize: sz(FontSize.md) },
    meta: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    smallBtn: {
      ...arcadeButton(t, 'outline'), borderRadius: BorderRadius.sm,
      paddingVertical: 6, paddingHorizontal: Spacing.two,
    },
    smallBtnPrimary: { ...arcadeButton(t) },
    smallBtnText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.sm },
    smallBtnTextPrimary: { ...arcadeButtonLabel(t) },
    muted: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm), textAlign: 'center', paddingVertical: Spacing.three },
    guestText: { color: t.text, fontFamily: font, fontSize: sz(FontSize.md), textAlign: 'center' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
  });
}

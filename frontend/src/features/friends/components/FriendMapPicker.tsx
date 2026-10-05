import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { useFriendsStore } from '../store';
import { fetchFriendProfile } from '../services/friends.api';
import type { FriendEntry, FriendMapMode } from '../types';

type Props = { visible: boolean; onClose: () => void };

/**
 * Map button → pick whose flashes the map shows: mine, a friend's ("Their map"),
 * or both on the 4-color shared map ("Compare").
 */
export function FriendMapPicker({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const friends = useFriendsStore((s) => s.overview.friends);
  const loaded = useFriendsStore((s) => s.loaded);
  const load = useFriendsStore((s) => s.load);
  const mapView = useFriendsStore((s) => s.mapView);
  const setMapView = useFriendsStore((s) => s.setMapView);

  // "<userId>-<mode>" while that friend's flashes are being fetched.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (visible) { setError(false); load(); }
  }, [visible, load]);

  async function pick(friend: FriendEntry, mode: FriendMapMode) {
    setBusy(`${friend.user_id}-${mode}`);
    setError(false);
    try {
      const profile = await fetchFriendProfile(friend.user_id);
      setMapView({ userId: friend.user_id, username: profile.username, flashedIds: profile.flashed_invader_ids, mode });
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  function showMine() {
    setMapView(null);
    onClose();
  }

  function goToSocial() {
    onClose();
    router.navigate('/social');
  }

  function modeButton(friend: FriendEntry, mode: FriendMapMode, label: string) {
    const active = mapView?.userId === friend.user_id && mapView.mode === mode;
    const loading = busy === `${friend.user_id}-${mode}`;
    return (
      <Pressable
        style={({ pressed }) => [styles.modeBtn, active && styles.modeBtnActive, pressed && styles.pressed]}
        onPress={() => pick(friend, mode)}
        disabled={busy !== null}
      >
        {loading
          ? <ActivityIndicator size="small" color={theme.accent} />
          : <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t('social.mapPickerTitle')}</Text>

          <Pressable
            style={({ pressed }) => [styles.mineRow, !mapView && styles.modeBtnActive, pressed && styles.pressed]}
            onPress={showMine}
          >
            <Text style={[styles.modeBtnText, !mapView && styles.modeBtnTextActive]}>{t('social.myMap')}</Text>
          </Pressable>

          {friends.length === 0 ? (
            loaded ? (
              <View style={styles.empty}>
                <Text style={styles.muted}>{t('social.noFriendsMap')}</Text>
                <Pressable style={({ pressed }) => [styles.modeBtn, pressed && styles.pressed]} onPress={goToSocial}>
                  <Text style={styles.modeBtnText}>{t('social.goToSocial')}</Text>
                </Pressable>
              </View>
            ) : (
              <ActivityIndicator color={theme.accent} style={styles.empty} />
            )
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {friends.map((f) => (
                <View key={f.id} style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>{f.username}</Text>
                  {modeButton(f, 'friend', t('social.theirMap'))}
                  {modeButton(f, 'compare', t('social.compare'))}
                </View>
              ))}
            </ScrollView>
          )}

          {error ? <Text style={styles.error}>{t('social.loadFailed')}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.four,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '75%',
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.lg,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    title: { color: t.accent, fontFamily: font, fontSize: sz(FontSize.lg), letterSpacing: 1 },
    mineRow: {
      borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      paddingVertical: 10, alignItems: 'center',
    },
    list: { flexGrow: 0 },
    listContent: { gap: Spacing.two },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    name: { flex: 1, color: t.text, fontFamily: font, fontSize: sz(FontSize.md) },
    modeBtn: {
      minWidth: 84, alignItems: 'center',
      borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      paddingVertical: 8, paddingHorizontal: Spacing.two,
    },
    modeBtnActive: { borderColor: t.accent, backgroundColor: t.accent },
    modeBtnText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm },
    modeBtnTextActive: { color: t.bg },
    empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
    muted: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm), textAlign: 'center' },
    error: { color: t.danger, fontFamily: font, fontSize: sz(FontSize.xs), textAlign: 'center' },
    pressed: { opacity: 0.7 },
  });
}

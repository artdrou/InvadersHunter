import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontSize } from '@/constants/theme';
import {
  fetchAdminRequest, fetchAdminSubmissions, fetchInvader,
  approveAdminRequest, rejectAdminRequest,
} from '@/features/admin/services/admin.api';
import { useAdminPickerStore } from '@/features/admin/store';
import { useInvaderStore } from '@/features/invaders/store';
import type { AdminRequest, AdminSubmission } from '@/features/admin/types';
import type { Invader } from '@/features/invaders/types';

function Diff({ label, current, proposed }: { label: string; current?: string | number | null; proposed?: string | number | null }) {
  const { theme, appFont } = useTheme();
  if (proposed === undefined || proposed === null) return null;
  const changed = String(proposed) !== String(current ?? '');
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ color: theme.textMuted, fontSize: 11, fontFamily: appFont }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
        {current !== undefined && current !== null && (
          <>
            <Text style={{ color: theme.textMuted, fontSize: 13, fontFamily: appFont }}>{String(current)}</Text>
            <Text style={{ color: theme.textMuted }}>→</Text>
          </>
        )}
        <Text style={{ color: changed ? theme.accent : theme.text, fontSize: 13, fontFamily: appFont, fontWeight: changed ? '600' : '400' }}>
          {String(proposed)}
        </Text>
      </View>
    </View>
  );
}

export default function AdminDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, fontScale, insets.bottom, insets.top);

  const [req, setReq]         = useState<AdminRequest | null>(null);
  const [invader, setInvader] = useState<Invader | null>(null);
  const [subs, setSubs]       = useState<AdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [pickedImageUrl, setPickedImageUrl] = useState<string | null>(null);
  // Full-screen "peek" preview shown while a thumbnail is long-pressed; cleared on release.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const requestSync = useInvaderStore((s) => s.requestSync);

  // Position picker result
  const pickedCoords    = useAdminPickerStore((s) => s.pickedCoords);
  const setPickedCoords = useAdminPickerStore((s) => s.setPickedCoords);
  // track if we've already consumed a pick result for this load
  const pickedConsumedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [r, s] = await Promise.all([
          fetchAdminRequest(Number(id)),
          fetchAdminSubmissions(Number(id)),
        ]);
        setReq(r);
        setSubs(s);
        // Default the photo selection to the aggregated proposal, falling back
        // to the first submission that has one.
        setPickedImageUrl(
          r.proposed_image_url
          ?? s.find((sub) => sub.proposed_image_url)?.proposed_image_url
          ?? null
        );
        if (r.invader_id) {
          const inv = await fetchInvader(r.invader_id);
          setInvader(inv);
        }
      } catch (e) {
        console.warn('[admin detail] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Clear picker result when leaving screen
  useEffect(() => {
    return () => {
      if (!pickedConsumedRef.current) setPickedCoords(null);
    };
  }, []);

  async function handleApprove() {
    if (!req) return;
    setActing(true);
    try {
      const coords = pickedCoords
        ? { latitude: pickedCoords.lat, longitude: pickedCoords.lon }
        : undefined;
      await approveAdminRequest(req.id, { coords, imageUrl: pickedImageUrl });
      setPickedCoords(null);
      pickedConsumedRef.current = true;
      requestSync();
      router.back();
    } catch (e: any) {
      Alert.alert(t('admin.errorTitle'), e?.response?.data?.detail ?? t('admin.failedApprove'));
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!req) return;
    Alert.alert(t('admin.rejectConfirmTitle'), t('admin.rejectConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.reject'), style: 'destructive', onPress: async () => {
          setActing(true);
          try {
            await rejectAdminRequest(req.id);
            router.back();
          } catch (e: any) {
            Alert.alert(t('admin.errorTitle'), e?.response?.data?.detail ?? t('admin.failedReject'));
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }

  function openPositionPicker() {
    if (!req) return;
    router.push({
      pathname: '/admin/pick-location',
      params: {
        adminRequestId: String(req.id),
        baryLat: String(req.proposed_latitude ?? invader?.latitude ?? 48.8566),
        baryLon: String(req.proposed_longitude ?? invader?.longitude ?? 2.3522),
        currentLat: String(invader?.latitude ?? ''),
        currentLon: String(invader?.longitude ?? ''),
      },
    });
  }

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );

  if (!req) return (
    <View style={styles.centered}>
      <Text style={{ color: theme.danger, fontFamily: appFont }}>{t('admin.requestNotFound')}</Text>
    </View>
  );

  const hasLocation = req.proposed_latitude !== null;
  const finalLat = pickedCoords?.lat ?? req.proposed_latitude;
  const finalLon = pickedCoords?.lon ?? req.proposed_longitude;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.backArrow')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {req.proposed_name ?? t('admin.requestPrefix', { id: req.id })}
        </Text>
        <View style={[styles.statusBadge, req.status === 'pending' ? styles.statusPending : req.status === 'approved' ? styles.statusApproved : styles.statusRejected]}>
          <Text style={styles.statusText}>{t(`admin.status${req.status.charAt(0).toUpperCase()}${req.status.slice(1)}`)}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Meta */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>{t('admin.type')}</Text>
            <Text style={styles.metaValue}>{req.request_type}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>{t('admin.votes')}</Text>
            <Text style={styles.metaValue}>{req.request_count}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>{t('admin.confidence')}</Text>
            <Text style={[styles.metaValue, { color: req.confidence >= 75 ? theme.success : req.confidence >= 45 ? '#f0a500' : theme.danger }]}>
              {req.confidence}%
            </Text>
          </View>
        </View>

        {/* Current invader */}
        {invader && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.current')}</Text>
            <View style={styles.row}><Text style={styles.metaLabel}>{t('admin.name')}</Text><Text style={styles.metaValue}>{invader.name}</Text></View>
            <View style={styles.row}><Text style={styles.metaLabel}>{t('admin.state')}</Text><Text style={styles.metaValue}>{invader.state ?? '—'}</Text></View>
            <View style={styles.row}><Text style={styles.metaLabel}>{t('admin.points')}</Text><Text style={styles.metaValue}>{invader.points ?? '—'}</Text></View>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>{t('admin.location')}</Text>
              <Text style={styles.metaValue}>{invader.latitude?.toFixed(5)}, {invader.longitude?.toFixed(5)}</Text>
            </View>
          </View>
        )}

        {/* Proposed changes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.proposed')}</Text>
          <Diff label={t('admin.name')}   current={invader?.name}   proposed={req.proposed_name} />
          <Diff label={t('admin.state')}  current={invader?.state}  proposed={req.proposed_state} />
          <Diff label={t('admin.points')} current={invader?.points} proposed={req.proposed_points} />
          {hasLocation && (
            <View>
              <Text style={styles.diffLabel}>{t('admin.location')}</Text>
              <Text style={[styles.metaValue, { color: theme.accent }]}>
                {(finalLat ?? 0).toFixed(6)}, {(finalLon ?? 0).toFixed(6)}
                {pickedCoords ? ` ${t('admin.byAdmin')}` : ` ${t('admin.byBary')}`}
              </Text>
              <Pressable style={({ pressed }) => [styles.mapBtn, pressed && styles.pressed]} onPress={openPositionPicker}>
                <Text style={styles.mapBtnText}>{t('admin.reviewOnMap')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Photo picker */}
        {subs.some((s) => s.proposed_image_url) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.photo')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {subs
                .filter((s) => s.proposed_image_url)
                .map((s) => {
                  const url = s.proposed_image_url!;
                  const selected = url === pickedImageUrl;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setPickedImageUrl(url)}
                      onLongPress={() => setPreviewUrl(url)}
                      onPressOut={() => setPreviewUrl(null)}
                      delayLongPress={250}
                      style={[styles.photoFrame, selected && styles.photoFrameSelected]}
                    >
                      <Image source={{ uri: url }} style={styles.photoThumb} resizeMode="cover" />
                      <Text style={styles.photoCaption} numberOfLines={1}>
                        {s.username ?? `#${s.user_id}`}
                      </Text>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        )}

        {/* Raw submissions */}
        {subs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.submissions', { count: subs.length })}</Text>
            {subs.map((s) => (
              <View key={s.id} style={styles.subCard}>
                <View style={styles.row}>
                  <Text style={styles.subUser}>{s.username ?? `#${s.user_id}`}</Text>
                  <Text style={styles.subDate}>{new Date(s.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.row}>
                  {s.proposed_state && <Text style={styles.subChip}>{s.proposed_state}</Text>}
                  {s.proposed_latitude !== null && <Text style={styles.subChip}>{t('admin.locationShort')}</Text>}
                  {s.proposed_points !== null && <Text style={styles.subChip}>{s.proposed_points} pts</Text>}
                  {s.proposed_name && <Text style={styles.subChip}>{s.proposed_name}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Actions */}
      {req.status === 'pending' && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}
            onPress={handleReject}
            disabled={acting}
          >
            <Text style={styles.rejectBtnText}>{acting ? '…' : t('admin.reject')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.approveBtn, pressed && styles.pressed]}
            onPress={handleApprove}
            disabled={acting}
          >
            <Text style={styles.approveBtnText}>{acting ? '…' : t('admin.approve')}</Text>
          </Pressable>
        </View>
      )}

      {/* Full-size photo peek — appears on long-press, closes on release or tap */}
      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
          {previewUrl && (
            <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number, bottomInset: number = 0, topInset: number = 0) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: t.bg },
    centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
      paddingHorizontal: Spacing.three, paddingTop: topInset + Spacing.three, paddingBottom: Spacing.two,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    backBtn:      { paddingRight: Spacing.two },
    backText:     { color: t.accent, fontSize: ButtonFontSize.xl, fontFamily: ButtonFont },
    headerTitle:  { flex: 1, color: t.text, fontSize: sz(FontSize.md), fontFamily: font },
    statusBadge:  { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    statusPending:  { backgroundColor: '#1a1a3a' },
    statusApproved: { backgroundColor: '#1a3a1a' },
    statusRejected: { backgroundColor: '#3a1a1a' },
    statusText:   { color: '#aaa', fontSize: ButtonFontSize.sm, fontFamily: ButtonFont },
    scroll:       { flex: 1 },
    scrollContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 + bottomInset },
    section: {
      backgroundColor: t.bgElement, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: t.border, padding: Spacing.three, gap: 6,
    },
    sectionTitle: { color: t.textMuted, fontSize: ButtonFontSize.md, fontFamily: ButtonFont, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaLabel:    { color: t.textMuted, fontSize: sz(13), fontFamily: font },
    metaValue:    { color: t.text, fontSize: sz(13), fontFamily: font },
    diffLabel:    { color: t.textMuted, fontSize: sz(11), fontFamily: font, marginBottom: 2 },
    mapBtn: {
      marginTop: Spacing.two, borderWidth: 1, borderColor: t.accent,
      borderRadius: BorderRadius.sm, paddingVertical: 8, alignItems: 'center',
    },
    mapBtnText:   { color: t.accent, fontSize: ButtonFontSize.lg, fontFamily: ButtonFont },
    subCard: {
      borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      padding: Spacing.two, gap: 4,
    },
    subChip: {
      color: t.textMuted, fontSize: sz(12), fontFamily: font,
      backgroundColor: t.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    },
    subUser:      { color: t.text, fontSize: sz(12), fontFamily: font, fontWeight: '600' },
    subDate:      { color: t.textMuted, fontSize: sz(11), fontFamily: font },
    photoStrip:   { gap: Spacing.two, paddingVertical: 4 },
    photoFrame: {
      borderWidth: 2, borderColor: 'transparent', borderRadius: BorderRadius.sm,
      padding: 2, alignItems: 'center',
    },
    photoFrameSelected: { borderColor: t.accent },
    photoThumb:   { width: 96, height: 96, borderRadius: BorderRadius.sm, backgroundColor: t.bg },
    photoCaption: { color: t.textMuted, fontSize: sz(10), fontFamily: font, marginTop: 2, maxWidth: 96 },
    previewBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center', alignItems: 'center',
    },
    previewImage: { width: '90%', aspectRatio: 1 },
    actions: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.three + bottomInset,
      backgroundColor: t.bg,
      borderTopWidth: 1, borderTopColor: t.border,
    },
    rejectBtn: {
      flex: 1, paddingVertical: 14, borderRadius: BorderRadius.sm,
      borderWidth: 1, borderColor: t.danger, alignItems: 'center',
    },
    rejectBtnText: { color: t.danger, fontFamily: ButtonFont, fontSize: ButtonFontSize.xl },
    approveBtn: {
      flex: 1, paddingVertical: 14, borderRadius: BorderRadius.sm,
      backgroundColor: t.accent, alignItems: 'center',
    },
    approveBtnText: { color: t.bg, fontFamily: ButtonFont, fontSize: ButtonFontSize.xl },
    pressed:      { opacity: 0.7 },
  });
}

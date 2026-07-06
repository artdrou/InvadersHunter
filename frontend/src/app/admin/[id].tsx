import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import {
  fetchAdminRequest, fetchAdminSubmissions, fetchInvader,
  approveAdminRequest, rejectAdminRequest,
} from '@/features/admin/services/admin.api';
import { useAdminPickerStore } from '@/features/admin/store';
import { useInvaderStore } from '@/features/invaders/store';
import { apiErrorDetail } from '@/services/api-client';
import { resolveInvaderName } from '@/features/admin/utils';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { TypeBadge } from '@/features/admin/components/TypeBadge';
import { ConfidenceBadge } from '@/features/admin/components/ConfidenceBadge';
import { logger } from '@/services/logger';
import { Diff } from '@/features/admin/components/Diff';
import type { AdminRequest, AdminSubmission } from '@/features/admin/types';
import type { Invader } from '@/features/invaders/types';

/** Pull the year out of an ISO date string (YYYY-...) for compact display. */
function yearOf(date?: string | null): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

export default function AdminDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, fontScale, insets.bottom, insets.top);
  const invaders = useInvaderStore((s) => s.invaders);

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
        logger.warn('[admin detail] load error', e);
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
  }, [setPickedCoords]);

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
    } catch (e) {
      Alert.alert(t('admin.errorTitle'), apiErrorDetail(e) ?? t('admin.failedApprove'));
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
          } catch (e) {
            Alert.alert(t('admin.errorTitle'), apiErrorDetail(e) ?? t('admin.failedReject'));
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
          {resolveInvaderName(req, invaders)}
        </Text>
        <StatusBadge status={req.status} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Meta */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>{t('admin.type')}</Text>
            <TypeBadge type={req.request_type} />
          </View>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>{t('admin.votes')}</Text>
            <Text style={styles.metaValue}>{req.request_count}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>{t('admin.confidence')}</Text>
            <ConfidenceBadge requestCount={req.request_count} confidence={req.confidence} />
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
          <Diff label={t('admin.year')}   current={yearOf(invader?.date_pose)} proposed={yearOf(req.proposed_date_pose)} />
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

        {/* Submissions */}
        {subs.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.submissionsCta, pressed && styles.pressed]}
            onPress={() => router.push(`/admin/${req.id}/submissions`)}
          >
            <Text style={styles.submissionsCtaText}>{t('admin.viewSubmissions', { count: subs.length })}</Text>
            <Text style={styles.submissionsCtaArrow}>›</Text>
          </Pressable>
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
    backText:     { color: t.accent, fontSize: FontSize.xl, fontFamily: ButtonFont },
    headerTitle:  { flex: 1, color: t.text, fontSize: sz(FontSize.md), fontFamily: font },
    scroll:       { flex: 1 },
    scrollContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 + bottomInset },
    section: {
      backgroundColor: t.bgElement, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: t.border, padding: Spacing.three, gap: 6,
    },
    sectionTitle: { color: t.textMuted, fontSize: FontSize.md, fontFamily: ButtonFont, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaLabel:    { color: t.textMuted, fontSize: sz(13), fontFamily: font },
    metaValue:    { color: t.text, fontSize: sz(13), fontFamily: font },
    diffLabel:    { color: t.textMuted, fontSize: sz(11), fontFamily: font, marginBottom: 2 },
    mapBtn: {
      marginTop: Spacing.two, borderWidth: 1, borderColor: t.accent,
      borderRadius: BorderRadius.sm, paddingVertical: 8, alignItems: 'center',
    },
    mapBtnText:   { color: t.accent, fontSize: FontSize.lg, fontFamily: ButtonFont },
    submissionsCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: t.bgElement, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: t.border, padding: Spacing.three,
    },
    submissionsCtaText: { color: t.text, fontSize: sz(FontSize.sm), fontFamily: font },
    submissionsCtaArrow: { color: t.accent, fontSize: FontSize.xl, fontFamily: ButtonFont },
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
    rejectBtnText: { color: t.danger, fontFamily: ButtonFont, fontSize: FontSize.xl },
    approveBtn: {
      flex: 1, paddingVertical: 14, borderRadius: BorderRadius.sm,
      backgroundColor: t.accent, alignItems: 'center',
    },
    approveBtnText: { color: t.bg, fontFamily: ButtonFont, fontSize: FontSize.xl },
    pressed:      { opacity: 0.7 },
  });
}

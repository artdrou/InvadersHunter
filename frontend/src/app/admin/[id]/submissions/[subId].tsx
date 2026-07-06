import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { fetchAdminSubmissions, fetchInvader } from '@/features/admin/services/admin.api';
import { TypeBadge } from '@/features/admin/components/TypeBadge';
import { Diff } from '@/features/admin/components/Diff';
import { logger } from '@/services/logger';
import type { AdminSubmission } from '@/features/admin/types';
import type { Invader } from '@/features/invaders/types';

function yearOf(date?: string | null): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

export default function AdminSubmissionDetailScreen() {
  const { id, subId } = useLocalSearchParams<{ id: string; subId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, fontScale, insets.top);

  const [sub, setSub]         = useState<AdminSubmission | null>(null);
  const [invader, setInvader] = useState<Invader | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !subId) return;
    (async () => {
      setLoading(true);
      try {
        const subs = await fetchAdminSubmissions(Number(id));
        const found = subs.find((s) => s.id === Number(subId)) ?? null;
        setSub(found);
        if (found?.invader_id) {
          setInvader(await fetchInvader(found.invader_id));
        }
      } catch (e) {
        logger.warn('[admin submission detail] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, subId]);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );

  if (!sub) return (
    <View style={styles.centered}>
      <Text style={{ color: theme.danger, fontFamily: appFont }}>{t('admin.requestNotFound')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.backArrow')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('admin.submissionDetailTitle')}</Text>
        <TypeBadge type={sub.request_type as 'create' | 'modify' | 'delete'} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>{t('admin.submissionBy', { username: sub.username ?? `#${sub.user_id}` })}</Text>
            <Text style={styles.metaValue}>{new Date(sub.created_at).toLocaleDateString()}</Text>
          </View>
        </View>

        {sub.proposed_image_url && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.photo')}</Text>
            <Pressable onPress={() => setPreviewUrl(sub.proposed_image_url)}>
              <Image source={{ uri: sub.proposed_image_url }} style={styles.photo} resizeMode="cover" />
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.proposed')}</Text>
          <Diff label={t('admin.name')}   current={invader?.name}   proposed={sub.proposed_name} />
          <Diff label={t('admin.state')}  current={invader?.state}  proposed={sub.proposed_state} />
          <Diff label={t('admin.points')} current={invader?.points} proposed={sub.proposed_points} />
          <Diff label={t('admin.year')}   current={yearOf(invader?.date_pose)} proposed={yearOf(sub.proposed_date_pose ?? null)} />
          {sub.proposed_latitude !== null && (
            <Diff label={t('admin.location')} current={null} proposed={`${sub.proposed_latitude?.toFixed(6)}, ${sub.proposed_longitude?.toFixed(6)}`} />
          )}
        </View>
      </ScrollView>

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

function makeStyles(t: ThemeTokens, font: string, scale: number, topInset: number = 0) {
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
    scrollContent: { padding: Spacing.three, gap: Spacing.three },
    section: {
      backgroundColor: t.bgElement, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: t.border, padding: Spacing.three, gap: 6,
    },
    sectionTitle: { color: t.textMuted, fontSize: FontSize.md, fontFamily: ButtonFont, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaLabel:    { color: t.textMuted, fontSize: sz(13), fontFamily: font },
    metaValue:    { color: t.text, fontSize: sz(13), fontFamily: font },
    photo:        { width: '100%', height: 200, borderRadius: BorderRadius.sm, backgroundColor: t.bg },
    previewBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center', alignItems: 'center',
    },
    previewImage: { width: '90%', aspectRatio: 1 },
  });
}

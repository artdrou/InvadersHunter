import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { fetchAdminSubmissions } from '@/features/admin/services/admin.api';
import { TypeBadge } from '@/features/admin/components/TypeBadge';
import { logger } from '@/services/logger';
import type { AdminSubmission } from '@/features/admin/types';

export default function AdminSubmissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, fontScale, insets.top);

  const [subs, setSubs] = useState<AdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        setSubs(await fetchAdminSubmissions(Number(id)));
      } catch (e) {
        logger.warn('[admin submissions] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function renderItem({ item }: { item: AdminSubmission }) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/admin/${id}/submissions/${item.id}`)}
      >
        <View style={styles.cardRow}>
          {item.proposed_image_url ? (
            <Image source={{ uri: item.proposed_image_url }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={styles.thumbPlaceholder} />
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.username} numberOfLines={1}>{item.username ?? `#${item.user_id}`}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <TypeBadge type={item.request_type as 'create' | 'modify' | 'delete'} />
        </View>
        <View style={styles.chipRow}>
          {item.proposed_name && <Text style={styles.chip}>{item.proposed_name}</Text>}
          {item.proposed_state && <Text style={styles.chip}>{item.proposed_state}</Text>}
          {item.proposed_latitude !== null && <Text style={styles.chip}>{t('admin.locationShort')}</Text>}
          {item.proposed_points !== null && <Text style={styles.chip}>{item.proposed_points} pts</Text>}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.backArrow')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('admin.submissions', { count: subs.length })}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={subs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t('admin.noSubmissions')}</Text>}
        />
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number, topInset: number = 0) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
      paddingHorizontal: Spacing.three, paddingTop: topInset + Spacing.three, paddingBottom: Spacing.two,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    backBtn:     { paddingRight: Spacing.two },
    backText:    { color: t.accent, fontSize: FontSize.xl, fontFamily: ButtonFont },
    headerTitle: { flex: 1, color: t.text, fontSize: sz(FontSize.md), fontFamily: font },
    list: { padding: Spacing.three, gap: Spacing.two },
    card: {
      backgroundColor: t.bgElement, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: t.border, padding: Spacing.three, gap: Spacing.two,
    },
    cardPressed: { opacity: 0.7 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    thumb: { width: 40, height: 40, borderRadius: BorderRadius.sm, backgroundColor: t.bg },
    thumbPlaceholder: { width: 40, height: 40, borderRadius: BorderRadius.sm, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border },
    cardInfo: { flex: 1 },
    username: { color: t.text, fontSize: sz(FontSize.sm), fontFamily: font },
    date: { color: t.textMuted, fontSize: sz(11), fontFamily: font },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      color: t.textMuted, fontSize: sz(12), fontFamily: font,
      backgroundColor: t.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    },
    empty: { color: t.textMuted, textAlign: 'center', marginTop: 60, fontSize: sz(FontSize.md), fontFamily: font },
  });
}

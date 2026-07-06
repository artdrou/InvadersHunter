import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, Brand } from '@/constants/theme';
import { fetchAdminRequests } from '@/features/admin/services/admin.api';
import { logger } from '@/services/logger';
import type { AdminRequest } from '@/features/admin/types';
import { useInvaderStore } from '@/features/invaders/store';
import { resolveInvaderName } from '@/features/admin/utils';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { ConfidenceBadge } from '@/features/admin/components/ConfidenceBadge';
import type { AdminRequestType } from '@/features/admin/components/TypeBadge';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';
type TypeFilter   = 'all' | 'modify' | 'create';

const TYPE_COLOR: Record<AdminRequestType, string> = {
  create: '#0060f0',
  modify: Brand.yellow,
  delete: Brand.uncapturedOutline,
};

const TYPE_ICON: Record<AdminRequestType, keyof typeof Ionicons.glyphMap> = {
  create: 'add-circle-outline',
  modify: 'create-outline',
  delete: 'trash-outline',
};

function changeSummary(req: AdminRequest): string {
  const parts: string[] = [];
  if (req.proposed_state)             parts.push(`state → ${req.proposed_state}`);
  if (req.proposed_latitude !== null) parts.push('location');
  if (req.proposed_name)              parts.push(`name → ${req.proposed_name}`);
  if (req.proposed_points !== null)   parts.push(`pts → ${req.proposed_points}`);
  return parts.join(' · ') || '—';
}

export default function RequestsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, fontScale);
  const invaders = useInvaderStore((s) => s.invaders);

  const [requests, setRequests]         = useState<AdminRequest[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all')   params.request_type = typeFilter;
      const data = await fetchAdminRequests(params);
      setRequests(data);
    } catch (e) {
      logger.warn('[requests] fetch failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function renderItem({ item }: { item: AdminRequest }) {
    const type      = item.request_type as AdminRequestType;
    const typeColor = TYPE_COLOR[type] ?? theme.border;
    const typeIcon  = TYPE_ICON[type]  ?? 'help-outline';

    return (
      <Pressable
        style={({ pressed }) => [styles.card, { borderColor: typeColor }, pressed && styles.cardPressed]}
        onPress={() => router.push(`/admin/${item.id}`)}
      >
        {/* Line 1: type icon · invader name · status badge */}
        <View style={styles.row1}>
          <Ionicons name={typeIcon} size={16} color={typeColor} />
          <Text style={styles.invaderName} numberOfLines={1}>
            {resolveInvaderName(item, invaders)}
          </Text>
          <StatusBadge status={item.status} />
        </View>
        {/* Line 2: date · change summary · count + confidence */}
        <View style={styles.row2}>
          <Text style={styles.metaText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          <Text style={styles.summaryText} numberOfLines={1}>{changeSummary(item)}</Text>
          <View style={styles.rightMeta}>
            <Text style={styles.metaText}>{item.request_count}</Text>
            <ConfidenceBadge requestCount={item.request_count} confidence={item.confidence} />
          </View>
        </View>
      </Pressable>
    );
  }

  const STATUS_TABS: StatusFilter[] = ['pending', 'all', 'approved', 'rejected'];
  const TYPE_TABS: TypeFilter[]     = ['all', 'modify', 'create'];
  const hasTypeFilter = typeFilter !== 'all';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Back + filter toggle */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.backArrow')}</Text>
        </Pressable>
        <Pressable style={styles.filterBtn} onPress={() => setShowTypeFilter((v) => !v)}>
          <Ionicons
            name="options-outline"
            size={22}
            color={hasTypeFilter ? theme.accent : theme.text}
          />
          {hasTypeFilter && <View style={styles.filterDot} />}
        </Pressable>
      </View>

      {/* Status filter — segmented control */}
      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedContainer}>
          {STATUS_TABS.map((s) => (
            <Pressable
              key={s}
              style={[styles.segmentedTab, statusFilter === s && styles.segmentedTabActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text
                style={[styles.segmentedText, statusFilter === s && styles.segmentedTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t(`admin.filter${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Type filter — collapsible row */}
      {showTypeFilter && (
        <View style={styles.typeFilterRow}>
          {TYPE_TABS.map((typ) => {
            const isActive = typeFilter === typ;
            const color    = typ !== 'all' ? TYPE_COLOR[typ as AdminRequestType] : theme.accent;
            return (
              <Pressable
                key={typ}
                style={[
                  styles.typeChip,
                  isActive && { borderColor: color, backgroundColor: color + '22' },
                ]}
                onPress={() => setTypeFilter(typ)}
              >
                {typ !== 'all' && (
                  <Ionicons
                    name={TYPE_ICON[typ as AdminRequestType]}
                    size={12}
                    color={isActive ? color : theme.textMuted}
                  />
                )}
                <Text style={[styles.typeChipText, isActive && { color }]}>
                  {t(`admin.filter${typ.charAt(0).toUpperCase()}${typ.slice(1)}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.accent}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{t('admin.noRequests')}</Text>
          }
        />
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    backBtn: { paddingRight: Spacing.two },
    backText: { color: t.accent, fontSize: FontSize.xl, fontFamily: ButtonFont },
    filterBtn: { position: 'relative', padding: 4 },
    filterDot: {
      position: 'absolute',
      top: 2, right: 2,
      width: 8, height: 8,
      borderRadius: 4,
      backgroundColor: t.accent,
    },

    segmentedWrapper: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.two,
    },
    segmentedContainer: {
      flexDirection: 'row',
      backgroundColor: t.bgElement,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    segmentedTab: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentedTabActive: { backgroundColor: t.text },
    segmentedText: {
      color: t.textMuted,
      fontSize: sz(FontSize.xs),
      fontFamily: ButtonFont,
    },
    segmentedTextActive: { color: t.bg },

    typeFilterRow: {
      flexDirection: 'row',
      gap: Spacing.one,
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.two,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: Spacing.two,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
    },
    typeChipText: {
      color: t.textMuted,
      fontSize: sz(FontSize.xs),
      fontFamily: ButtonFont,
    },

    list: { padding: Spacing.three, gap: Spacing.two },

    card: {
      backgroundColor: t.bgElement,
      borderRadius: BorderRadius.md,
      borderWidth: 1.5,
      padding: Spacing.three,
      gap: Spacing.one,
    },
    cardPressed: { opacity: 0.7 },

    row1: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    invaderName: {
      flex: 1,
      color: t.text,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },

    row2: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    metaText: {
      color: t.textMuted,
      fontSize: sz(FontSize.xxs),
      fontFamily: font,
    },
    summaryText: {
      flex: 1,
      color: t.textMuted,
      fontSize: sz(FontSize.xxs),
      fontFamily: font,
    },
    rightMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },

    empty: {
      color: t.textMuted,
      textAlign: 'center',
      marginTop: 60,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
  });
}

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { fetchAdminRequests } from '@/features/admin/services/admin.api';
import type { AdminRequest } from '@/features/admin/types';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';
type TypeFilter   = 'all' | 'modify' | 'create';

function confidenceColor(score: number, theme: ThemeTokens): string {
  if (score >= 75) return theme.success;
  if (score >= 45) return '#f0a500';
  return theme.danger;
}

function changeSummary(req: AdminRequest): string {
  const parts: string[] = [];
  if (req.proposed_state)   parts.push(`state → ${req.proposed_state}`);
  if (req.proposed_latitude !== null) parts.push('location');
  if (req.proposed_name)    parts.push(`name → ${req.proposed_name}`);
  if (req.proposed_points !== null) parts.push(`pts → ${req.proposed_points}`);
  return parts.join(' · ') || '—';
}

export default function AdminScreen() {
  const router = useRouter();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all')   params.request_type = typeFilter;
      const data = await fetchAdminRequests(params);
      setRequests(data);
    } catch (e) {
      console.warn('[admin] fetch failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  function renderItem({ item }: { item: AdminRequest }) {
    const conf = item.confidence;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/admin/${item.id}`)}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, item.request_type === 'create' ? styles.badgeCreate : styles.badgeModify]}>
            <Text style={[styles.badgeText, { fontFamily: appFont }]}>
              {item.request_type === 'create' ? 'CREATE' : 'MODIFY'}
            </Text>
          </View>
          <Text style={styles.invaderName} numberOfLines={1}>
            {item.proposed_name ?? `#${item.invader_id}`}
          </Text>
          <View style={styles.metaRight}>
            <Text style={styles.voteText}>{item.request_count}✓</Text>
            <View style={[styles.confBadge, { backgroundColor: confidenceColor(conf, theme) }]}>
              <Text style={styles.confText}>{conf}%</Text>
            </View>
          </View>
        </View>
        <Text style={styles.summary} numberOfLines={1}>{changeSummary(item)}</Text>
      </Pressable>
    );
  }

  const STATUS_TABS: StatusFilter[] = ['pending', 'all', 'approved', 'rejected'];
  const TYPE_TABS: TypeFilter[]   = ['all', 'modify', 'create'];

  return (
    <View style={styles.container}>
      {/* Status filter */}
      <View style={styles.filterRow}>
        {STATUS_TABS.map((s) => (
          <Pressable
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Type filter */}
      <View style={[styles.filterRow, { marginTop: 0 }]}>
        {TYPE_TABS.map((t) => (
          <Pressable
            key={t}
            style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}
            onPress={() => setTypeFilter(t)}
          >
            <Text style={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

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
            <Text style={styles.empty}>No requests</Text>
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
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.one,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.one,
    },
    filterChip: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    filterChipActive: { borderColor: t.accent, backgroundColor: t.bgElement },
    filterChipText: { color: t.textMuted, fontSize: sz(11), fontFamily: ButtonFont },
    filterChipTextActive: { color: t.accent },
    list: { padding: Spacing.three, gap: Spacing.two },
    card: {
      backgroundColor: t.bgElement,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: t.border,
      padding: Spacing.three,
      gap: Spacing.one,
    },
    cardPressed: { opacity: 0.7 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    typeBadge: {
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeCreate: { backgroundColor: '#1a3a1a' },
    badgeModify: { backgroundColor: '#1a1a3a' },
    badgeText: { fontSize: sz(9), color: '#aaa', letterSpacing: 0.5 },
    invaderName: {
      flex: 1,
      color: t.text,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    metaRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    voteText: { color: t.textMuted, fontSize: sz(12), fontFamily: font },
    confBadge: {
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      minWidth: 38,
      alignItems: 'center',
    },
    confText: { color: '#fff', fontSize: sz(11), fontFamily: ButtonFont },
    summary: { color: t.textMuted, fontSize: sz(12), fontFamily: font },
    empty: {
      color: t.textMuted,
      textAlign: 'center',
      marginTop: 60,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
  });
}

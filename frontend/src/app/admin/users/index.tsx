import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { fetchUsers } from '@/features/admin/services/admin.api';
import { formatServerDate } from '@/features/admin/utils';
import type { AdminUser } from '@/features/admin/types';

/** Admin: every account in the database, searchable by username or email. */
export default function AdminUsersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, appFont, fontScale), [theme, appFont, fontScale]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(false);
    try {
      const list = await fetchUsers();
      list.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
      setUsers(list);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  function renderItem({ item }: { item: AdminUser }) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/admin/users/${item.id}`)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.row1}>
            <Text style={styles.username} numberOfLines={1}>{item.username}</Text>
            {item.is_admin ? <Text style={styles.adminBadge}>{t('adminUsers.adminBadge')}</Text> : null}
          </View>
          <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
          <Text style={styles.meta}>{t('adminUsers.joined', { date: formatServerDate(item.created_at) })}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.backArrow')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('adminUsers.title')}</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('adminUsers.searchPlaceholder')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {!loading && !error ? (
        <Text style={styles.count}>{t('adminUsers.count', { count: filtered.length, total: users.length })}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error ? (
        <Pressable style={styles.center} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.empty}>{t('adminUsers.loadFailed')}</Text>
        </Pressable>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.five }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.accent} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('adminUsers.empty')}</Text>}
        />
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, fontScale: number) {
  const sz = (n: number) => Math.round(n * fontScale);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    backText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },
    title: { color: t.accent, fontFamily: font, fontSize: sz(FontSize.xl), letterSpacing: 1 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginHorizontal: Spacing.four,
      marginTop: Spacing.three,
      paddingHorizontal: Spacing.three,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
    },
    searchInput: { flex: 1, color: t.text, fontFamily: font, fontSize: sz(FontSize.sm), paddingVertical: 10 },
    count: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs,
      marginHorizontal: Spacing.four, marginTop: Spacing.two,
    },
    list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      padding: Spacing.three,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
    },
    cardPressed: { opacity: 0.7 },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: t.accent,
    },
    avatarText: { color: t.accent, fontFamily: ButtonFont, fontSize: FontSize.lg },
    cardBody: { flex: 1, gap: 2 },
    row1: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    username: { flexShrink: 1, color: t.text, fontFamily: font, fontSize: sz(FontSize.md) },
    adminBadge: {
      color: t.accent, fontFamily: ButtonFont, fontSize: FontSize.xxs,
      borderWidth: 1, borderColor: t.accent, borderRadius: BorderRadius.sm,
      paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden',
    },
    email: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xs) },
    meta: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xxs },
    center: { marginTop: Spacing.six, alignSelf: 'center' },
    empty: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm), textAlign: 'center', marginTop: Spacing.five },
  });
}

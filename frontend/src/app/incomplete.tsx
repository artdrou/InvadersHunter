import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, Spacing, FontSize, ButtonFont, BorderRadius } from '@/constants/theme';
import { useInvaderData, mapInvadersWithProgress, cityOf } from '@/features/invaders';
import type { InvaderWithState } from '@/features/invaders';
import { EDIT_FIELDS, groupIncomplete, type EditField } from '@/features/invaders/edit-fields';
import { useIncompleteStore } from '@/features/invaders/incomplete-store';
import { useListEditing } from '@/features/invaders/hooks/use-list-editing';
import { useLocateStore } from '@/features/map';
import { useAuthStore, GUEST_USER_ID } from '@/features/auth';
import { hapticTap, hapticSuccess, hapticDisappoint } from '@/features/settings';
import { ISS_INVADER_NAME } from '@/features/iss/constants';

// Info-line label of each field (same words as the invader panel)
const FIELD_LABEL: Record<EditField, string> = {
  location: 'popup.position',
  photo: 'popup.photo',
  points: 'popup.points',
  state: 'popup.state',
  posed: 'popup.posed',
};

type Item =
  | { type: 'header'; key: string; city: string; count: number; expanded: boolean }
  | { type: 'row'; key: string; invader: InvaderWithState; missing: Set<EditField>; expanded: boolean }
  | { type: 'panel'; key: string; invader: InvaderWithState };

/**
 * Community page (from the Social tab): every invader with missing details,
 * grouped by city, filterable by what is missing. Each one opens the usual
 * panel, whose "+ Add" chips and "Modifier" propose the missing details.
 */
export default function IncompleteInvadersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(theme, appFont, fontScale), [theme, appFont, fontScale]);

  const { invaders, progress, flash, unflash, submitModifyRequest } = useInvaderData();
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);

  const fields = useIncompleteStore((s) => s.fields);
  const toggleField = useIncompleteStore((s) => s.toggleField);
  const clearFields = useIncompleteStore((s) => s.clearFields);
  const expandedCities = useIncompleteStore((s) => s.expandedCities);
  const toggleCity = useIncompleteStore((s) => s.toggleCity);
  const expandCity = useIncompleteStore((s) => s.expandCity);
  const [expandedInvaderId, setExpandedInvaderId] = useState<number | null>(null);

  const invadersWithState = useMemo(
    () => mapInvadersWithProgress(invaders, progress).filter((i) => i.name !== ISS_INVADER_NAME),
    [invaders, progress],
  );
  const { groups, counts } = useMemo(
    () => groupIncomplete(invadersWithState, new Set(fields), cityOf),
    [invadersWithState, fields],
  );

  const handleFlash = useCallback(async (invader: InvaderWithState) => {
    const uid = user?.id ?? (isGuest ? GUEST_USER_ID : null);
    if (uid == null) return;
    await flash(uid, invader.id);
    hapticSuccess();
  }, [user, isGuest, flash]);

  const handleUnflash = useCallback(async (invader: InvaderWithState) => {
    if (!invader.progressId) return;
    if (await unflash(invader.progressId)) hapticDisappoint();
  }, [unflash]);

  const handleLocate = useCallback((invader: InvaderWithState) => {
    setPendingInvader(invader.id);
    router.navigate('/(tabs)/map');
  }, [setPendingInvader, router]);

  // Back from the map's location picker: reopen that invader (and its city)
  const expandInvader = useCallback((id: number) => {
    const inv = invadersWithState.find((i) => i.id === id);
    if (inv) expandCity(cityOf(inv.name));
    setExpandedInvaderId(id);
  }, [invadersWithState, expandCity]);

  const { renderPanel } = useListEditing({
    target: 'incomplete',
    expandedInvaderId,
    expandInvader,
    onSubmitModifyRequest: submitModifyRequest,
    onFlash: handleFlash,
    onUnflash: handleUnflash,
    onLocate: handleLocate,
  });

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const g of groups) {
      const expanded = expandedCities.includes(g.city);
      out.push({ type: 'header', key: `h|${g.city}`, city: g.city, count: g.items.length, expanded });
      if (!expanded) continue;
      for (const { invader, missing } of g.items) {
        const open = expandedInvaderId === invader.id;
        out.push({ type: 'row', key: `r|${invader.id}`, invader, missing, expanded: open });
        if (open) out.push({ type: 'panel', key: `p|${invader.id}`, invader });
      }
    }
    return out;
  }, [groups, expandedCities, expandedInvaderId]);

  const renderItem = useCallback(({ item }: { item: Item }) => {
    switch (item.type) {
      case 'header':
        return (
          <Pressable
            style={({ pressed }) => [styles.cityHeader, pressed && styles.pressed]}
            onPress={() => { hapticTap(); toggleCity(item.city); }}
          >
            <Text style={styles.cityName}>{item.city}</Text>
            <View style={styles.cityRight}>
              <Text style={styles.cityCount}>{t('incomplete.count', { count: item.count })}</Text>
              <Ionicons name={item.expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
            </View>
          </Pressable>
        );
      case 'row':
        return (
          <Pressable
            style={({ pressed }) => [styles.row, item.expanded && styles.rowOpen, pressed && styles.pressed]}
            onPress={() => setExpandedInvaderId((prev) => (prev === item.invader.id ? null : item.invader.id))}
          >
            <Text style={styles.rowName}>{item.invader.name}</Text>
            <Text style={styles.rowMissing} numberOfLines={1}>
              {EDIT_FIELDS.filter((f) => item.missing.has(f)).map((f) => t(FIELD_LABEL[f])).join(' · ')}
            </Text>
          </Pressable>
        );
      case 'panel':
        return renderPanel(item.invader, styles.panel);
    }
  }, [styles, theme, t, toggleCity, renderPanel]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backText}>{`< ${t('common.back')}`}</Text>
        </Pressable>
        <Text style={styles.title}>{t('incomplete.title')}</Text>
        <Text style={styles.intro}>{t('incomplete.intro')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersBar}
        contentContainerStyle={styles.filters}
      >
        <FilterChip label={`${t('incomplete.all')} ${counts.all}`} selected={fields.length === 0} onPress={clearFields} styles={styles} />
        {EDIT_FIELDS.map((f) => (
          <FilterChip
            key={f}
            label={`${t(FIELD_LABEL[f])} ${counts[f]}`}
            selected={fields.includes(f)}
            onPress={() => toggleField(f)}
            styles={styles}
          />
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t('incomplete.empty')}</Text>}
      />
    </View>
  );
}

function FilterChip({ label, selected, onPress, styles }: {
  label: string; selected: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={() => { hapticTap(); onPress(); }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, gap: Spacing.two },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    backText: { fontFamily: ButtonFont, fontSize: FontSize.md, color: t.textMuted },
    title: { fontSize: FontSize.xxl, letterSpacing: 1, color: t.accent, fontFamily: font },
    intro: { fontSize: sz(FontSize.xs), color: t.textMuted, fontFamily: font },
    // A horizontal ScrollView in a column otherwise stretches with a short list
    // (giant chips) or gets squeezed by a long one (clipped labels): keep its height.
    filtersBar: { flexGrow: 0, flexShrink: 0 },
    filters: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.two, alignItems: 'center' },
    chip: {
      borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two, paddingVertical: 6,
    },
    chipSelected: { borderColor: t.accent, backgroundColor: t.bgElement },
    chipText: { color: t.textMuted, fontSize: sz(FontSize.xs), fontFamily: font },
    chipTextSelected: { color: t.accent },
    listContent: { flexGrow: 1 },
    cityHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.four, paddingVertical: Spacing.three,
      borderBottomWidth: 1, borderBottomColor: t.bgDivider,
    },
    cityName: { color: t.accent, fontSize: sz(17), fontFamily: font },
    cityRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    cityCount: { color: t.textMuted, fontSize: sz(FontSize.xs), fontFamily: font },
    row: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three,
      paddingHorizontal: Spacing.four, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: t.bgDivider,
    },
    rowOpen: { backgroundColor: t.bgElement },
    rowName: { color: t.text, fontSize: sz(FontSize.sm), fontFamily: font },
    rowMissing: { flexShrink: 1, color: t.textMuted, fontSize: sz(FontSize.xxs), fontFamily: font, textAlign: 'right' },
    panel: { borderBottomWidth: 1, borderBottomColor: t.bgDivider },
    empty: { textAlign: 'center', color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm), padding: Spacing.five },
    pressed: { opacity: 0.7 },
  });
}

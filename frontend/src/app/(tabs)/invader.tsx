import { useState, useMemo, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  useInvaderData,
  mapInvadersWithProgress, buildGroups, SORT_OPTIONS_BY_GROUP,
  InvaderInfoPanel, CityHeader, InvaderListRow, InvaderGridCell,
  InvaderSearchBar,
} from "@/features/invaders";
import type { InvaderWithState, SortOption, GroupMode } from "@/features/invaders";
import { applyMapFilter, DEFAULT_FILTER, useLocateStore } from "@/features/map";
import type { MapFilter } from "@/features/map";
import { useAuthStore } from "@/features/auth";
import { useTheme } from "@/contexts/theme-context";
import { Spacing } from "@/constants/theme";

const GRID_COLS = 3;
const GRID_GAP  = 4;

// ── flat list item types ─────────────────────────────────────────────────────

type FlatItem =
  | { type: "header";    key: string; groupKey: string; capturedCount: number; total: number; expanded: boolean }
  | { type: "row";       key: string; invader: InvaderWithState; isExpanded: boolean }
  | { type: "info";      key: string; invader: InvaderWithState }
  | { type: "grid-row";  key: string; invaders: InvaderWithState[] }
  | { type: "grid-info"; key: string; invader: InvaderWithState };

// ── screen ───────────────────────────────────────────────────────────────────

export default function InvadersScreen() {
  const { invaders, progress, syncError, flash, unflash } = useInvaderData();
  const isOfflineEmpty = invaders.length === 0 && syncError === 'network';

  const [expandedCities, setExpandedCities]       = useState<Set<string>>(new Set());
  const [expandedInvaderId, setExpandedInvaderId] = useState<number | null>(null);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<MapFilter>(DEFAULT_FILTER);
  const [groupMode, setGroupMode] = useState<GroupMode>("city");
  const [sortBy, setSortBy]       = useState<SortOption>("number");
  const [viewMode, setViewMode]   = useState<"list" | "grid">("grid");

  const user = useAuthStore((s) => s.user);
  const { theme, appFont } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);

  // ── derived data (memoized so FlatList gets stable references) ───────────

  const invadersWithState = useMemo(
    () => mapInvadersWithProgress(invaders, progress),
    [invaders, progress],
  );

  const query       = search.trim().toUpperCase();
  const isSearching = query.length > 0;

  const filtered = useMemo(() => {
    const searched = isSearching
      ? invadersWithState.filter((inv) => inv.name.toUpperCase().includes(query))
      : invadersWithState;
    return applyMapFilter(searched, filter);
  }, [invadersWithState, query, isSearching, filter]);

  const groups = useMemo(
    () => buildGroups(filtered, groupMode, sortBy),
    [filtered, groupMode, sortBy],
  );

  const cellSize = Math.floor(
    (screenWidth - Spacing.two * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
  );

  // ── flat data for FlatList ─────────────────────────────────────────────────
  // Groups are flattened into a typed item array. Only expanded groups emit
  // their children, so collapsed sections cost only the header item.

  const flatData = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];

    for (const [groupKey, groupInvaders] of groups) {
      const hasHeader  = groupKey !== "";
      const isExpanded = !hasHeader || isSearching || expandedCities.has(groupKey);

      if (hasHeader) {
        items.push({
          type: "header",
          key: `h|${groupKey}`,
          groupKey,
          capturedCount: groupInvaders.filter((i) => i.isCaptured).length,
          total: groupInvaders.length,
          expanded: isExpanded,
        });
      }

      if (!isExpanded) continue;

      if (viewMode === "list") {
        for (const inv of groupInvaders) {
          const isExpanded = expandedInvaderId === inv.id;
          items.push({ type: "row",  key: `r|${inv.id}`,    invader: inv, isExpanded });
          if (isExpanded) {
            items.push({ type: "info", key: `info|${inv.id}`, invader: inv });
          }
        }
      } else {
        for (let i = 0; i < groupInvaders.length; i += GRID_COLS) {
          const rowInvaders = groupInvaders.slice(i, i + GRID_COLS);
          const selected    = rowInvaders.find((inv) => inv.id === expandedInvaderId);
          items.push({ type: "grid-row",  key: `gr|${groupKey}|${i}`, invaders: rowInvaders });
          if (selected) {
            items.push({ type: "grid-info", key: `gi|${selected.id}`, invader: selected });
          }
        }
      }
    }

    return items;
  }, [groups, expandedCities, expandedInvaderId, isSearching, viewMode]);

  // ── handlers ────────────────────────────────────────────────────────────────

  const toggleCity = useCallback((key: string) => {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleInvader = useCallback((id: number) => {
    setExpandedInvaderId((prev) => (prev === id ? null : id));
  }, []);

  const handleFlash = useCallback(async (invader: InvaderWithState) => {
    if (!user) return;
    await flash(user.id, invader.id);
  }, [user, flash]);

  const handleUnflash = useCallback(async (invader: InvaderWithState) => {
    if (!invader.progressId) return;
    await unflash(invader.progressId);
  }, [unflash]);

  const handleLocate = useCallback((invader: InvaderWithState) => {
    setPendingInvader(invader.id);
    router.push("/(tabs)/map");
  }, [setPendingInvader, router]);

  const handleGroupModeChange = useCallback((g: GroupMode) => {
    setGroupMode(g);
    setSortBy((prev) => SORT_OPTIONS_BY_GROUP[g].includes(prev) ? prev : "number");
  }, []);

  const handleToggleView = useCallback(() => {
    setViewMode((v) => v === "list" ? "grid" : "list");
  }, []);

  // ── render item ─────────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item }: { item: FlatItem }) => {
    switch (item.type) {
      case "header":
        return (
          <CityHeader
            city={item.groupKey}
            capturedCount={item.capturedCount}
            total={item.total}
            expanded={item.expanded}
            onPress={() => toggleCity(item.groupKey)}
          />
        );

      case "row":
        return (
          <View style={{ borderBottomWidth: 1, borderBottomColor: theme.bgDivider }}>
            <InvaderListRow
              invader={item.invader}
              expanded={item.isExpanded}
              onPress={() => toggleInvader(item.invader.id)}
            />
          </View>
        );

      case "info":
        return (
          <InvaderInfoPanel
            invader={item.invader}
            onFlash={handleFlash}
            onUnflash={handleUnflash}
            onLocate={handleLocate}
            containerStyle={{ borderTopWidth: 1, borderTopColor: theme.bgDivider, borderBottomWidth: 1, borderBottomColor: theme.bgDivider }}
          />
        );

      case "grid-row":
        return (
          <View style={[styles.gridRow, { padding: GRID_GAP, gap: GRID_GAP }]}>
            {item.invaders.map((inv) => (
              <InvaderGridCell
                key={inv.id}
                invader={inv}
                size={cellSize}
                selected={expandedInvaderId === inv.id}
                onPress={() => toggleInvader(inv.id)}
              />
            ))}
          </View>
        );

      case "grid-info":
        return (
          <InvaderInfoPanel
            invader={item.invader}
            onFlash={handleFlash}
            onUnflash={handleUnflash}
            onLocate={handleLocate}
            containerStyle={{
              marginHorizontal: GRID_GAP,
              marginBottom: GRID_GAP,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          />
        );
    }
  }, [toggleCity, toggleInvader, handleFlash, handleUnflash, handleLocate, theme, cellSize, expandedInvaderId]);

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <InvaderSearchBar
        value={search}
        onChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        groupMode={groupMode}
        onGroupModeChange={handleGroupModeChange}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onToggleView={handleToggleView}
      />

      {isOfflineEmpty ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: appFont }]}>
            No internet connection
          </Text>
          <Text style={[styles.emptySubText, { color: theme.textMuted, fontFamily: appFont }]}>
            Connect to load invaders
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews
          maxToRenderPerBatch={20}
          windowSize={10}
          initialNumToRender={30}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.six },
  gridRow: { flexDirection: "row" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15 },
  emptySubText: { fontSize: 12, opacity: 0.6 },
});

import { useState } from "react";
import { View, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  useInvaderData,
  mapInvadersWithProgress, groupByCity,
  InvaderInfoPanel, CityHeader, InvaderListRow, InvaderGridCell,
  InvaderSearchBar, InvaderFilterBar,
} from "@/features/invaders";
import type { InvaderWithState } from "@/features/invaders";
import { applyMapFilter, DEFAULT_FILTER, useLocateStore } from "@/features/map";
import type { MapFilter } from "@/features/map";
import { useAuthStore } from "@/features/auth";
import { useTheme } from "@/contexts/theme-context";
import { Spacing } from "@/constants/theme";

const GRID_COLS = 3;
const GRID_GAP  = 4;

export default function InvadersScreen() {
  const { invaders, progress, flash, unflash }      = useInvaderData();
  const [expandedCities, setExpandedCities]         = useState<Set<string>>(new Set());
  const [expandedInvaderId, setExpandedInvaderId]   = useState<number | null>(null);
  const [search, setSearch]                         = useState("");
  const [strictSearch, setStrictSearch]             = useState(true);
  const [filter, setFilter]                         = useState<MapFilter>(DEFAULT_FILTER);
  const [viewMode, setViewMode]                     = useState<"list" | "grid">("list");

  const user = useAuthStore((s) => s.user);
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);

  // ── derived data ────────────────────────────────────────────────────────────

  const invadersWithState = mapInvadersWithProgress(invaders, progress);

  const query       = search.trim().toUpperCase();
  const isSearching = query.length > 0;

  const searched = isSearching
    ? invadersWithState.filter((inv) =>
        strictSearch
          ? inv.name.toUpperCase().startsWith(query)
          : inv.name.toUpperCase().includes(query))
    : invadersWithState;

  const filtered = applyMapFilter(searched, filter);
  const grouped  = groupByCity(filtered);

  const cellSize = Math.floor(
    (screenWidth - Spacing.two * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
  );

  // ── handlers ────────────────────────────────────────────────────────────────

  function toggleCity(city: string) {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city); else next.add(city);
      return next;
    });
  }

  function toggleInvader(id: number) {
    setExpandedInvaderId((prev) => (prev === id ? null : id));
  }

  async function handleFlash(invader: InvaderWithState) {
    if (!user) return;
    await flash(user.id, invader.id);
  }

  async function handleUnflash(invader: InvaderWithState) {
    if (!invader.progressId) return;
    await unflash(invader.progressId);
  }

  function handleLocate(invader: InvaderWithState) {
    setPendingInvader(invader.id);
    router.push("/(tabs)/map");
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <InvaderSearchBar
        value={search}
        onChange={setSearch}
        strict={strictSearch}
        onToggleStrict={() => setStrictSearch((v) => !v)}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => v === "list" ? "grid" : "list")}
      />

      <InvaderFilterBar filter={filter} onChange={setFilter} />

      {viewMode === "list" ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {grouped.map(([city, cityInvaders]) => {
            const expanded      = isSearching || expandedCities.has(city);
            const capturedCount = cityInvaders.filter((i) => i.isCaptured).length;

            return (
              <View key={city}>
                <CityHeader
                  city={city}
                  capturedCount={capturedCount}
                  total={cityInvaders.length}
                  expanded={expanded}
                  onPress={() => toggleCity(city)}
                />

                {expanded && cityInvaders.map((inv) => {
                  const invExpanded = expandedInvaderId === inv.id;
                  return (
                    <View key={inv.id} style={{ borderBottomWidth: 1, borderBottomColor: theme.bgDivider }}>
                      <InvaderListRow
                        invader={inv}
                        expanded={invExpanded}
                        onPress={() => toggleInvader(inv.id)}
                      />
                      {invExpanded && (
                        <InvaderInfoPanel
                          invader={inv}
                          onFlash={handleFlash}
                          onUnflash={handleUnflash}
                          onLocate={handleLocate}
                          containerStyle={{ borderTopWidth: 1, borderTopColor: theme.bgDivider }}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {grouped.map(([city, cityInvaders]) => {
            const expanded      = isSearching || expandedCities.has(city);
            const capturedCount = cityInvaders.filter((i) => i.isCaptured).length;

            // Split into rows of GRID_COLS so the info panel appears below the right row
            const rows: InvaderWithState[][] = [];
            for (let i = 0; i < cityInvaders.length; i += GRID_COLS) {
              rows.push(cityInvaders.slice(i, i + GRID_COLS));
            }

            return (
              <View key={city}>
                <CityHeader
                  city={city}
                  capturedCount={capturedCount}
                  total={cityInvaders.length}
                  expanded={expanded}
                  onPress={() => toggleCity(city)}
                />

                {expanded && (
                  <View style={{ borderBottomWidth: 1, borderBottomColor: theme.bgDivider }}>
                    {rows.map((rowInvaders, rowIdx) => {
                      const selectedInRow = rowInvaders.find((i) => i.id === expandedInvaderId);
                      return (
                        <View key={rowIdx}>
                          <View style={[styles.gridRow, { padding: GRID_GAP, gap: GRID_GAP }]}>
                            {rowInvaders.map((inv) => (
                              <InvaderGridCell
                                key={inv.id}
                                invader={inv}
                                size={cellSize}
                                selected={expandedInvaderId === inv.id}
                                onPress={() => toggleInvader(inv.id)}
                              />
                            ))}
                          </View>
                          {selectedInRow && (
                            <InvaderInfoPanel
                              invader={selectedInRow}
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
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.six },
  gridRow: {
    flexDirection: "row",
  },
});

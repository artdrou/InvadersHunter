import { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  useInvaderData,
  mapInvadersWithProgress, buildGroups,
  InvaderInfoPanel, CityHeader, InvaderListRow, InvaderGridCell,
  MosaicToolbar, DEFAULT_TOOLBAR_STATE,
} from "@/features/invaders";
import type { InvaderWithState, ToolbarState } from "@/features/invaders";
import { applyMapFilter, useLocateStore } from "@/features/map";
import { PopupEdit } from "@/features/map/components/InvaderPopup/PopupEdit";
import { makeStyles as makePopupStyles } from "@/features/map/components/InvaderPopup/styles";
import type { EditField } from "@/features/invaders/edit-fields";
import { useNewsUnreadCount } from "@/features/news";
import { useAuthStore, GUEST_USER_ID, useRequireAccount } from "@/features/auth";
import { useTheme } from "@/contexts/theme-context";
import { hapticSuccess, hapticDisappoint } from "@/features/settings";
import { Spacing, FontSize } from "@/constants/theme";

const GRID_GAP = 4;

// ── flat list item types ─────────────────────────────────────────────────────

type FlatItem =
  | { type: "header";    key: string; groupKey: string; capturedCount: number; total: number; expanded: boolean }
  | { type: "row";       key: string; invader: InvaderWithState; isExpanded: boolean }
  | { type: "info";      key: string; invader: InvaderWithState }
  | { type: "grid-row";  key: string; invaders: InvaderWithState[] }
  | { type: "grid-info"; key: string; invader: InvaderWithState };

// ── screen ───────────────────────────────────────────────────────────────────

export default function InvadersScreen() {
  const { t } = useTranslation();
  const { invaders, progress, syncError, flash, unflash, submitModifyRequest } = useInvaderData();
  const isOfflineEmpty = invaders.length === 0 && syncError === 'network';

  const [expandedCities, setExpandedCities]       = useState<Set<string>>(new Set());
  const [expandedInvaderId, setExpandedInvaderId] = useState<number | null>(null);
  const [toolbar, setToolbar]                     = useState<ToolbarState>(DEFAULT_TOOLBAR_STATE);

  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { theme, appFont, fontScale } = useTheme();
  const popupStyles = useMemo(() => makePopupStyles(theme, appFont, fontScale), [theme, appFont, fontScale]);
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);
  const requireAccount = useRequireAccount();
  const setPickForList = useLocateStore((s) => s.setPickForList);
  const pickedForList = useLocateStore((s) => s.pickedForList);
  const setPickedForList = useLocateStore((s) => s.setPickedForList);
  // Edit form shown in place of an expanded invader's info panel
  const [editing, setEditing] = useState<{
    invaderId: number;
    field: EditField | null;
    coords: { lat: number; lon: number } | null;
  } | null>(null);
  const newsUnread = useNewsUnreadCount();

  // ── derived data ─────────────────────────────────────────────────────────

  const invadersWithState = useMemo(
    () => mapInvadersWithProgress(invaders, progress),
    [invaders, progress],
  );

  const query       = toolbar.search.trim().toUpperCase();
  const isSearching = query.length > 0;

  const filtered = useMemo(() => {
    const searched = isSearching
      ? invadersWithState.filter((inv) => inv.name.toUpperCase().includes(query))
      : invadersWithState;
    return applyMapFilter(searched, toolbar.filter);
  }, [invadersWithState, query, isSearching, toolbar.filter]);

  const groups = useMemo(
    () => buildGroups(filtered, toolbar.groupMode, toolbar.sortBy, toolbar.sortDir),
    [filtered, toolbar.groupMode, toolbar.sortBy, toolbar.sortDir],
  );

  const cellSize = useMemo(() => {
    const cols = toolbar.viewMode === "grid" ? toolbar.gridCols : 3;
    return Math.floor((screenWidth - Spacing.two * 2 - GRID_GAP * (cols - 1)) / cols);
  }, [screenWidth, toolbar.viewMode, toolbar.gridCols]);

  // ── flat data for FlatList ────────────────────────────────────────────────

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

      if (toolbar.viewMode === "list") {
        for (const inv of groupInvaders) {
          const isExpandedInv = expandedInvaderId === inv.id;
          items.push({ type: "row",  key: `r|${inv.id}`,    invader: inv, isExpanded: isExpandedInv });
          if (isExpandedInv) {
            items.push({ type: "info", key: `info|${inv.id}`, invader: inv });
          }
        }
      } else {
        const cols = toolbar.gridCols;
        for (let i = 0; i < groupInvaders.length; i += cols) {
          const rowInvaders = groupInvaders.slice(i, i + cols);
          const selected    = rowInvaders.find((inv) => inv.id === expandedInvaderId);
          items.push({ type: "grid-row",  key: `gr|${groupKey}|${i}`, invaders: rowInvaders });
          if (selected) {
            items.push({ type: "grid-info", key: `gi|${selected.id}`, invader: selected });
          }
        }
      }
    }

    return items;
  }, [groups, expandedCities, expandedInvaderId, isSearching, toolbar.viewMode, toolbar.gridCols]);

  // ── handlers ─────────────────────────────────────────────────────────────

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
    const uid = user?.id ?? (isGuest ? GUEST_USER_ID : null);
    if (uid == null) return;
    await flash(uid, invader.id);
    hapticSuccess();
  }, [user, isGuest, flash]);

  const handleUnflash = useCallback(async (invader: InvaderWithState) => {
    if (!invader.progressId) return;
    const removed = await unflash(invader.progressId);
    if (removed) hapticDisappoint();
  }, [unflash]);

  const handleLocate = useCallback((invader: InvaderWithState) => {
    setPendingInvader(invader.id);
    router.push("/(tabs)/map");
  }, [setPendingInvader, router]);

  // A location is picked on the map: the map comes back here with it (pickedForList)
  const pickLocation = useCallback((invader: InvaderWithState) => {
    setPickForList(invader.id);
    router.navigate("/(tabs)/map");
  }, [setPickForList, router]);

  // "Modify" (field null) or "+ Add" on a missing detail: the edit form opens in the
  // list; a missing location goes straight to the map picker
  const handleModify = useCallback((invader: InvaderWithState, field: EditField | null) => {
    requireAccount(() => {
      if (field === "location") { pickLocation(invader); return; }
      setEditing({ invaderId: invader.id, field, coords: null });
    });
  }, [requireAccount, pickLocation]);

  useEffect(() => {
    if (!pickedForList) return;
    const { invaderId, lat, lon } = pickedForList;
    setPickedForList(null);
    setExpandedInvaderId(invaderId);
    setEditing((prev) => ({
      invaderId,
      field: prev?.invaderId === invaderId ? prev.field : null,
      coords: { lat, lon },
    }));
  }, [pickedForList, setPickedForList]);

  // Collapsing / switching invaders drops an open edit form
  useEffect(() => {
    setEditing((prev) => (prev && prev.invaderId !== expandedInvaderId ? null : prev));
  }, [expandedInvaderId]);

  const renderPanel = useCallback((invader: InvaderWithState, containerStyle: object) => {
    if (editing?.invaderId === invader.id) {
      return (
        <View style={[styles.editPanel, { backgroundColor: theme.bgElement }, containerStyle]}>
          <PopupEdit
            invader={invader}
            pendingCoords={editing.coords}
            initialField={editing.field}
            onClose={() => setEditing(null)}
            onPickLocation={pickLocation}
            onRequestSent={() => hapticSuccess()}
            onSubmitModifyRequest={submitModifyRequest}
            styles={popupStyles}
          />
        </View>
      );
    }
    return (
      <InvaderInfoPanel
        invader={invader}
        onFlash={handleFlash}
        onUnflash={handleUnflash}
        onLocate={handleLocate}
        onModify={handleModify}
        containerStyle={containerStyle}
      />
    );
  }, [editing, theme, popupStyles, pickLocation, submitModifyRequest, handleFlash, handleUnflash, handleLocate, handleModify]);

  // ── render item ──────────────────────────────────────────────────────────

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
        return renderPanel(item.invader, {
          borderTopWidth: 1, borderTopColor: theme.bgDivider, borderBottomWidth: 1, borderBottomColor: theme.bgDivider,
        });

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
        return renderPanel(item.invader, {
          marginHorizontal: GRID_GAP,
          marginBottom: GRID_GAP,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.border,
        });
    }
  }, [toggleCity, toggleInvader, renderPanel, theme, cellSize, expandedInvaderId]);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <MosaicToolbar
        state={toolbar}
        onChange={setToolbar}
        newsUnreadCount={newsUnread}
        onOpenNews={() => router.push('/news')}
      />

      {isOfflineEmpty ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: appFont }]}>
            {t('invaders.noInternetTitle')}
          </Text>
          <Text style={[styles.emptySubText, { color: theme.textMuted, fontFamily: appFont }]}>
            {t('invaders.noInternetSub')}
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
  editPanel: { padding: Spacing.three, gap: Spacing.two },
  gridRow: { flexDirection: "row" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyText: { fontSize: FontSize.sm },
  emptySubText: { fontSize: FontSize.xs, opacity: 0.6 },
});

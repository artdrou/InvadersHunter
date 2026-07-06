import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, Modal,
  Animated, PanResponder, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, Motion } from "@/constants/theme";
import { isFilterActive } from "@/features/map/filter";
import type { SortOption, GroupMode } from "../../utils/invader-list";
import { SORT_OPTIONS_BY_GROUP, SORT_DEFAULT_DIR } from "../../utils/invader-list";
import { toolbarStyles } from "./styles";
import {
  GRID_COLS_MIN, GRID_COLS_MAX, MAIN_MENU_HEIGHT,
  SUB_SHEET_HEIGHT_RATIO, DRAG_MAX_RATIO, DRAG_THRESHOLD, SHEET_SPRING,
  STATUS_KEYS, FLASHABLE_KEYS, GROUP_KEYS, SORT_KEYS,
} from "./constants";
import type { ToolbarState, SubSheet } from "./constants";
import { GridSlider } from "./GridSlider";
import { MenuRow } from "./MenuRow";
import { SquareIconBtn, BadgeIconBtn, NewsIconBtn } from "./IconButtons";
import { SortSubSheet, FilterSubSheet, GroupSubSheet } from "./SubSheets";

export { DEFAULT_TOOLBAR_STATE } from "./constants";
export type { ToolbarState } from "./constants";

type Props = {
  state: ToolbarState;
  onChange: (s: ToolbarState) => void;
  /** Unread news count for the journal button badge. Button is hidden unless `onOpenNews` is set. */
  newsUnreadCount?: number;
  onOpenNews?: () => void;
};

/**
 * Toolbar above the invader mosaic: search + view toggle + a bottom sheet that
 * drills into Sort / Filter / Group sub-sheets. The heavy pieces (sub-sheets,
 * icon buttons, grid slider, styles, constants) live in sibling files.
 */
export function MosaicToolbar({ state, onChange, newsUnreadCount = 0, onOpenNews }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const styles = toolbarStyles;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetY = useRef(new Animated.Value(screenHeight)).current;

  const [activeSubSheet, setActiveSubSheet] = useState<SubSheet | null>(null);
  const mainX = useRef(new Animated.Value(0)).current;
  const subX  = useRef(new Animated.Value(screenWidth)).current;

  // The sliding-panel area opens at MAIN_MENU_HEIGHT for the menu and one consistent
  // taller size for every sub-sheet. The user can drag the handle to resize from there.
  const panelH = useRef(new Animated.Value(MAIN_MENU_HEIGHT)).current;
  const SUB_SHEET_HEIGHT = Math.round(screenHeight * SUB_SHEET_HEIGHT_RATIO);
  const DRAG_MAX = Math.round(screenHeight * DRAG_MAX_RATIO);
  const panelTargetHeight = activeSubSheet == null ? MAIN_MENU_HEIGHT : SUB_SHEET_HEIGHT;

  useEffect(() => {
    Animated.timing(panelH, { toValue: panelTargetHeight, duration: Motion.sheetIn, useNativeDriver: false }).start();
  }, [panelTargetHeight, panelH]);

  // Drag the grab-handle to resize the panel to a desired height (overrides the auto size).
  const dragStartH = useRef(0);
  const dragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => { panelH.stopAnimation((v: number) => { dragStartH.current = v; }); },
      onPanResponderMove: (_e, g) => {
        const next = dragStartH.current - g.dy; // drag up → taller
        panelH.setValue(Math.max(MAIN_MENU_HEIGHT, Math.min(DRAG_MAX, next)));
      },
    })
  ).current;

  function update(partial: Partial<ToolbarState>) {
    onChange({ ...state, ...partial });
  }

  // Sort: 3-click cycle (default dir → inverted → erase)
  function handleSortPress(option: SortOption) {
    if (state.sortBy !== option) {
      onChange({ ...state, sortBy: option, sortDir: SORT_DEFAULT_DIR[option] });
    } else {
      const defaultDir = SORT_DEFAULT_DIR[option];
      if (state.sortDir !== defaultDir) {
        onChange({ ...state, sortBy: "number", sortDir: "asc" });
      } else {
        onChange({ ...state, sortDir: state.sortDir === "asc" ? "desc" : "asc" });
      }
    }
  }

  function handleSortReset() {
    onChange({ ...state, sortBy: "number", sortDir: "asc" });
  }

  function handleGroupModeChange(g: GroupMode) {
    const nextSortBy = SORT_OPTIONS_BY_GROUP[g].includes(state.sortBy) ? state.sortBy : "number";
    onChange({ ...state, groupMode: g, sortBy: nextSortBy });
  }

  // Sheet animation
  function openSheet() {
    setSheetOpen(true);
    setActiveSubSheet(null);
    mainX.setValue(0);
    subX.setValue(screenWidth);
    panelH.setValue(MAIN_MENU_HEIGHT);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }).start();
  }

  function closeSheet() {
    Animated.timing(sheetY, {
      toValue: screenHeight, duration: Motion.sheetOut, useNativeDriver: true,
    }).start(() => { setSheetOpen(false); setActiveSubSheet(null); });
  }

  function navigateTo(sub: SubSheet) {
    setActiveSubSheet(sub);
    subX.setValue(screenWidth);
    Animated.parallel([
      Animated.timing(mainX, { toValue: -screenWidth, duration: Motion.sheetIn, useNativeDriver: true }),
      Animated.timing(subX,  { toValue: 0,            duration: Motion.sheetIn, useNativeDriver: true }),
    ]).start();
  }

  function navigateBack() {
    Animated.parallel([
      Animated.timing(mainX, { toValue: 0,           duration: Motion.sheetIn, useNativeDriver: true }),
      Animated.timing(subX,  { toValue: screenWidth, duration: Motion.sheetIn, useNativeDriver: true }),
    ]).start(() => setActiveSubSheet(null));
  }

  // Badge = 1 per active filter + 1 if sort non-default + 1 if group non-default
  const badgeCount =
    (state.sortBy !== "number" ? 1 : 0) +
    (state.groupMode !== "city" ? 1 : 0) +
    (state.filter.status !== "all" ? 1 : 0) +
    (state.filter.flashable !== "any" ? 1 : 0) +
    state.filter.points.length;

  // Active filter chips (dismissible, filters only)
  type Chip = { key: string; label: string; onDismiss: () => void };
  const chips: Chip[] = [];
  if (state.filter.status !== "all") {
    chips.push({
      key: `status-${state.filter.status}`,
      label: t(STATUS_KEYS[state.filter.status]),
      onDismiss: () => update({ filter: { ...state.filter, status: "all" } }),
    });
  }
  if (state.filter.flashable !== "any") {
    chips.push({
      key: `flashable-${state.filter.flashable}`,
      label: t(FLASHABLE_KEYS[state.filter.flashable]),
      onDismiss: () => update({ filter: { ...state.filter, flashable: "any" } }),
    });
  }
  for (const pt of state.filter.points) {
    const snap = pt;
    chips.push({
      key: `pt-${snap}`,
      label: `${snap} pts`,
      onDismiss: () =>
        update({ filter: { ...state.filter, points: state.filter.points.filter((p) => p !== snap) } }),
    });
  }

  const availableSorts = SORT_OPTIONS_BY_GROUP[state.groupMode];

  const subSheetTitle =
    activeSubSheet === "sort"   ? t("invaders.sortBy")  :
    activeSubSheet === "filter" ? t("invaders.filter")  :
    activeSubSheet === "group"  ? t("invaders.groupBy") :
    t("invaders.controls");

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, borderBottomColor: theme.bgDivider }]}>
      {/* Row 1: news + search + view toggle + controls badge */}
      <View style={styles.row1}>
        {onOpenNews && (
          <NewsIconBtn unread={newsUnreadCount} onPress={onOpenNews} theme={theme} styles={styles} />
        )}
        <View style={[styles.searchWrap, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={14} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text, fontFamily: appFont, fontSize: sz(13) }]}
            placeholder={t("invaders.searchPlaceholder")}
            placeholderTextColor={theme.textMuted}
            value={state.search}
            onChangeText={(v) => update({ search: v })}
            autoCapitalize="characters"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <SquareIconBtn
          icon={state.viewMode === "grid" ? "grid-outline" : "list-outline"}
          active={state.viewMode === "list"}
          onPress={() => update({ viewMode: state.viewMode === "grid" ? "list" : "grid" })}
          theme={theme} styles={styles}
        />
        <BadgeIconBtn badgeCount={badgeCount} onPress={openSheet} theme={theme} styles={styles} />
      </View>

      {/* Row 2: active filter chips */}
      {chips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {chips.map((chip) => (
            <Pressable key={chip.key} style={[styles.chip, { backgroundColor: theme.accent }]} onPress={chip.onDismiss}>
              <Text style={[styles.chipText, { color: theme.bg }]}>{chip.label}</Text>
              <Ionicons name="close-outline" size={11} color={theme.bg} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Bottom sheet */}
      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { backgroundColor: theme.bg, transform: [{ translateY: sheetY }] }]}>

            {/* Drag handle — drag up/down to resize the panel */}
            <View style={styles.handleRow} {...dragResponder.panHandlers}>
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
            </View>

            {/* Header: back / title / close */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.bgDivider }]}>
              <Pressable onPress={activeSubSheet ? navigateBack : undefined} style={styles.headerSide} hitSlop={12}>
                {activeSubSheet && <Ionicons name="chevron-back" size={18} color={theme.accent} />}
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{subSheetTitle}</Text>
              <Pressable onPress={closeSheet} style={styles.headerSide} hitSlop={12}>
                <Ionicons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Sliding panel area — height grows to fit the active panel */}
            <Animated.View style={[styles.panelArea, { width: screenWidth, height: panelH }]}>
              {/* Main menu */}
              <Animated.View
                style={[styles.panel, { transform: [{ translateX: mainX }], backgroundColor: theme.bg }]}
                pointerEvents={activeSubSheet ? "none" : "auto"}
              >
                <MenuRow
                  icon="swap-vertical-outline"
                  label={t("invaders.sortBy")}
                  value={state.sortBy !== "number" ? `${t(SORT_KEYS[state.sortBy])} ${state.sortDir === "asc" ? "↑" : "↓"}` : "—"}
                  active={state.sortBy !== "number"}
                  onPress={() => navigateTo("sort")}
                  theme={theme} styles={styles}
                />
                <MenuRow
                  icon="options-outline"
                  label={t("invaders.filter")}
                  value={
                    isFilterActive(state.filter)
                      ? String(
                          (state.filter.status !== "all" ? 1 : 0) +
                          (state.filter.flashable !== "any" ? 1 : 0) +
                          state.filter.points.length
                        )
                      : "—"
                  }
                  active={isFilterActive(state.filter)}
                  onPress={() => navigateTo("filter")}
                  theme={theme} styles={styles}
                />
                <MenuRow
                  icon="albums-outline"
                  label={t("invaders.groupBy")}
                  value={t(GROUP_KEYS[state.groupMode])}
                  active={state.groupMode !== "city"}
                  onPress={() => navigateTo("group")}
                  theme={theme} styles={styles}
                />
              </Animated.View>

              {/* Sub-sheet panel — slides in from the right */}
              <Animated.View
                style={[styles.panel, styles.panelAbsolute, { transform: [{ translateX: subX }], backgroundColor: theme.bg }]}
                pointerEvents={activeSubSheet ? "auto" : "none"}
              >
                <ScrollView>
                  {activeSubSheet === "sort" && (
                    <SortSubSheet
                      sortBy={state.sortBy} sortDir={state.sortDir}
                      availableSorts={availableSorts}
                      onSortPress={handleSortPress} onSortReset={handleSortReset}
                      theme={theme} styles={styles} t={t}
                    />
                  )}
                  {activeSubSheet === "filter" && (
                    <FilterSubSheet
                      filter={state.filter}
                      onChange={(f) => update({ filter: f })}
                      theme={theme} styles={styles} t={t}
                    />
                  )}
                  {activeSubSheet === "group" && (
                    <GroupSubSheet
                      groupMode={state.groupMode}
                      onChange={handleGroupModeChange}
                      theme={theme} styles={styles} t={t}
                    />
                  )}
                </ScrollView>
              </Animated.View>
            </Animated.View>

            {/* View toggle + grid size slider — always visible at bottom of sheet */}
            <View style={[styles.sheetBottom, { borderTopColor: theme.bgDivider, paddingBottom: insets.bottom + Spacing.four }]}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t("invaders.viewMode")}</Text>
              <View style={styles.sheetBottomRow}>
                <View style={styles.segmented}>
                  {(["grid", "list"] as const).map((mode) => {
                    const sel = state.viewMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        style={[styles.segBtn, { borderColor: theme.border }, sel && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                        onPress={() => update({ viewMode: mode })}
                      >
                        <Ionicons name={mode === "grid" ? "grid-outline" : "list-outline"} size={18} color={sel ? theme.bg : theme.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
                {state.viewMode === "grid" && (
                  <View style={styles.sheetSliderWrap}>
                    <Ionicons name="apps-outline" size={14} color={theme.textMuted} />
                    <GridSlider
                      value={state.gridCols}
                      min={GRID_COLS_MIN}
                      max={GRID_COLS_MAX}
                      onChange={(v) => update({ gridCols: v })}
                      theme={theme} styles={styles}
                    />
                    <Ionicons name="grid-outline" size={14} color={theme.textMuted} />
                  </View>
                )}
              </View>
            </View>

          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

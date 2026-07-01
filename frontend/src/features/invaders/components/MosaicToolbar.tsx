import { useState, useRef, useMemo, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, Modal,
  Animated, PanResponder, useWindowDimensions, StyleSheet,
  type LayoutChangeEvent, type GestureResponderEvent,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, BorderRadius, ButtonFont, ButtonFontSize, Spacing } from "@/constants/theme";
// Import directly from the source file (not the @/features/map barrel) to avoid a
// require cycle: invaders/index → MosaicToolbar → map/index → invader-popup → invaders/index.
// Through the barrel, DEFAULT_FILTER resolved to undefined at module-load time in the
// production bundle and crashed with "Cannot read property 'DEFAULT_FILTER' of undefined".
import type { MapFilter, FlashStatusFilter, FlashableFilter } from "@/features/map/components/map-filter-bar";
import { DEFAULT_FILTER, isFilterActive } from "@/features/map/components/map-filter-bar";
import type { SortOption, SortDir, GroupMode } from "../utils/invader-list";
import { SORT_OPTIONS_BY_GROUP, SORT_DEFAULT_DIR } from "../utils/invader-list";
import { PixelButton } from "@/components/ui/pixel-button";

// ── Types ──────────────────────────────────────────────────────────────────

export type ToolbarState = {
  search: string;
  viewMode: "grid" | "list";
  gridCols: number;   // 2–5, only relevant in grid mode
  sortBy: SortOption;
  sortDir: SortDir;
  groupMode: GroupMode;
  filter: MapFilter;
};

export const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  search: "",
  viewMode: "grid",
  gridCols: 3,
  sortBy: "number",
  sortDir: "asc",
  groupMode: "city",
  filter: DEFAULT_FILTER,
};

const GRID_COLS_MIN = 2;
const GRID_COLS_MAX = 5;

// Sliding-panel heights. Main menu = 3 rows × 56px. Every sub-sheet opens at one
// consistent, taller size (so options read comfortably); the user can drag the handle
// to resize from there, and the filter scrolls if its content overflows.
const MAIN_MENU_HEIGHT = 168;

type SubSheet = "sort" | "filter" | "group";

type Props = {
  state: ToolbarState;
  onChange: (s: ToolbarState) => void;
  /** Unread news count for the journal button badge. Button is hidden unless `onOpenNews` is set. */
  newsUnreadCount?: number;
  onOpenNews?: () => void;
};

// ── Label maps ─────────────────────────────────────────────────────────────

const POINTS_OPTIONS = [10, 20, 30, 40, 50, 100];

const STATUS_KEYS: Record<FlashStatusFilter, string> = {
  all:       "invaders.statusAll",
  flashed:   "invaders.statusFlashed",
  unflashed: "invaders.statusUnflashed",
};

const FLASHABLE_KEYS: Record<FlashableFilter, string> = {
  any:         "invaders.condAny",
  flashable:   "invaders.condFlashable",
  unflashable: "invaders.condUnflashable",
};

const GROUP_KEYS: Record<GroupMode, string> = {
  none:   "invaders.groupNone",
  city:   "invaders.groupCity",
  points: "invaders.groupPoints",
  year:   "invaders.groupYear",
};

const SORT_KEYS: Record<SortOption, string> = {
  number:      "invaders.sortNumber",
  name:        "invaders.sortName",
  points:      "invaders.sortPoints",
  pose_date:   "invaders.sortPoseDate",
  flash_date:  "invaders.sortFlashDate",
  update_date: "invaders.sortUpdated",
};

// ── Component ──────────────────────────────────────────────────────────────

export function MosaicToolbar({ state, onChange, newsUnreadCount = 0, onOpenNews }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
  const SUB_SHEET_HEIGHT = Math.round(screenHeight * 0.36);
  const DRAG_MAX = Math.round(screenHeight * 0.6);
  const panelTargetHeight = activeSubSheet == null ? MAIN_MENU_HEIGHT : SUB_SHEET_HEIGHT;

  useEffect(() => {
    Animated.timing(panelH, { toValue: panelTargetHeight, duration: 220, useNativeDriver: false }).start();
  }, [panelTargetHeight, panelH]);

  // Drag the grab-handle to resize the panel to a desired height (overrides the auto size).
  const dragStartH = useRef(0);
  const dragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
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
    Animated.spring(sheetY, {
      toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.8,
    }).start();
  }

  function closeSheet() {
    Animated.timing(sheetY, {
      toValue: screenHeight, duration: 260, useNativeDriver: true,
    }).start(() => { setSheetOpen(false); setActiveSubSheet(null); });
  }

  function navigateTo(sub: SubSheet) {
    setActiveSubSheet(sub);
    subX.setValue(screenWidth);
    Animated.parallel([
      Animated.timing(mainX, { toValue: -screenWidth, duration: 220, useNativeDriver: true }),
      Animated.timing(subX,  { toValue: 0,            duration: 220, useNativeDriver: true }),
    ]).start();
  }

  function navigateBack() {
    Animated.parallel([
      Animated.timing(mainX, { toValue: 0,           duration: 220, useNativeDriver: true }),
      Animated.timing(subX,  { toValue: screenWidth, duration: 220, useNativeDriver: true }),
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

// ── Grid size slider ───────────────────────────────────────────────────────

type SliderProps = {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  theme: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
};

function GridSlider({ value, min, max, onChange, theme, styles }: SliderProps) {
  const trackRef = useRef<View>(null);
  const trackPageX = useRef(0);
  const trackWidth = useRef(0);

  function updateFromPageX(pageX: number) {
    if (trackWidth.current === 0) return;
    const x = Math.max(0, Math.min(pageX - trackPageX.current, trackWidth.current));
    const ratio = x / trackWidth.current;
    const val = Math.round(min + ratio * (max - min));
    onChange(Math.max(min, Math.min(max, val)));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        trackRef.current?.measureInWindow((x, _y, w) => {
          trackPageX.current = x;
          trackWidth.current = w;
          updateFromPageX(e.nativeEvent.pageX);
        });
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        updateFromPageX(e.nativeEvent.pageX);
      },
    })
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    trackWidth.current = e.nativeEvent.layout.width;
    trackRef.current?.measureInWindow((x) => { trackPageX.current = x; });
  }

  const fillRatio = (value - min) / (max - min);

  return (
    <View
      ref={trackRef}
      style={styles.sliderTrackOuter}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.sliderTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.sliderFill, { flex: fillRatio, backgroundColor: theme.accent }]} />
        <View style={{ flex: 1 - fillRatio }} />
      </View>
      <View style={[styles.sliderThumb, { backgroundColor: theme.accent, borderColor: theme.bg, left: `${fillRatio * 100}%` as any }]} />
    </View>
  );
}

// ── Sub-sheets ─────────────────────────────────────────────────────────────

type SubSheetHelpers = {
  theme: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
  t: (k: string) => string;
};

function SortSubSheet({
  sortBy, sortDir, availableSorts, onSortPress, onSortReset, theme, styles, t,
}: SubSheetHelpers & {
  sortBy: SortOption; sortDir: SortDir;
  availableSorts: SortOption[];
  onSortPress: (o: SortOption) => void;
  onSortReset: () => void;
}) {
  return (
    <View>
      {availableSorts.map((key) => {
        const sel = sortBy === key;
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [styles.option, sel && { backgroundColor: theme.accent }, pressed && styles.optionPressed]}
            onPress={() => onSortPress(key)}
            onLongPress={onSortReset}
            delayLongPress={400}
          >
            <View style={styles.sortOptionRow}>
              <Text style={[styles.optionText, { color: sel ? theme.bg : theme.text }]}>{t(SORT_KEYS[key])}</Text>
              {sel && <Ionicons name={sortDir === "asc" ? "arrow-up-outline" : "arrow-down-outline"} size={14} color={theme.bg} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterSubSheet({ filter, onChange, theme, styles, t }: SubSheetHelpers & { filter: MapFilter; onChange: (f: MapFilter) => void }) {
  const STATUS_OPTIONS: { key: FlashStatusFilter; label: string }[] = [
    { key: "all",       label: t("invaders.statusAll") },
    { key: "flashed",   label: t("invaders.statusFlashed") },
    { key: "unflashed", label: t("invaders.statusUnflashed") },
  ];
  const FLASHABLE_OPTIONS: { key: FlashableFilter; label: string }[] = [
    { key: "any",         label: t("invaders.condAny") },
    { key: "flashable",   label: t("invaders.condFlashable") },
    { key: "unflashable", label: t("invaders.condUnflashable") },
  ];

  function togglePoint(pt: number) {
    const pts = filter.points.includes(pt) ? filter.points.filter((p) => p !== pt) : [...filter.points, pt];
    onChange({ ...filter, points: pts });
  }

  // Filter has several categories, so lay them out side-by-side in columns to stay compact.
  // Each column is a plain text list (no buttons): the selected option highlights in accent.
  return (
    <View style={styles.filterColumns}>
      <View style={styles.filterColumn}>
        <Text style={[styles.columnLabel, { color: theme.textMuted }]}>{t("invaders.filterStatus")}</Text>
        {STATUS_OPTIONS.map((o) => {
          const sel = filter.status === o.key;
          return (
            <Pressable key={o.key} style={({ pressed }) => [styles.colOption, sel && { backgroundColor: theme.accent }, pressed && styles.optionPressed]} onPress={() => onChange({ ...filter, status: o.key })}>
              <Text style={[styles.optionText, { color: sel ? theme.bg : theme.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filterColumn}>
        <Text style={[styles.columnLabel, { color: theme.textMuted }]}>{t("invaders.filterCondition")}</Text>
        {FLASHABLE_OPTIONS.map((o) => {
          const sel = filter.flashable === o.key;
          return (
            <Pressable key={o.key} style={({ pressed }) => [styles.colOption, sel && { backgroundColor: theme.accent }, pressed && styles.optionPressed]} onPress={() => onChange({ ...filter, flashable: o.key })}>
              <Text style={[styles.optionText, { color: sel ? theme.bg : theme.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filterColumn}>
        <Text style={[styles.columnLabel, { color: theme.textMuted }]}>{t("invaders.filterPoints")}</Text>
        {POINTS_OPTIONS.map((pt) => {
          const sel = filter.points.includes(pt);
          return (
            <Pressable key={pt} style={({ pressed }) => [styles.colOption, sel && { backgroundColor: theme.accent }, pressed && styles.optionPressed]} onPress={() => togglePoint(pt)}>
              <Text style={[styles.optionText, { color: sel ? theme.bg : theme.text }]}>{pt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GroupSubSheet({ groupMode, onChange, theme, styles, t }: SubSheetHelpers & { groupMode: GroupMode; onChange: (g: GroupMode) => void }) {
  const OPTIONS: { key: GroupMode; label: string }[] = [
    { key: "none",   label: t("invaders.groupNone") },
    { key: "city",   label: t("invaders.groupCity") },
    { key: "points", label: t("invaders.groupPoints") },
    { key: "year",   label: t("invaders.groupYear") },
  ];
  return (
    <View>
      {OPTIONS.map((o) => {
        const sel = groupMode === o.key;
        return (
          <Pressable key={o.key} style={({ pressed }) => [styles.option, sel && { backgroundColor: theme.accent }, pressed && styles.optionPressed]} onPress={() => onChange(o.key)}>
            <Text style={[styles.optionText, { color: sel ? theme.bg : theme.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Toolbar icon buttons ───────────────────────────────────────────────────

type IconBtnProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
  theme: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
};

function SquareIconBtn({ icon, active, onPress, theme, styles }: IconBtnProps) {
  const [size, setSize] = useState(0);
  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== size) setSize(w);
  }
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} onLayout={onLayout}>
      {size > 0 && <PixelButton size={size} fill={theme.bgElement} stroke={active ? theme.accent : theme.border} />}
      <Ionicons name={icon} size={Math.max(16, Math.round(size * 0.45))} color={active ? theme.accent : theme.textMuted} />
    </Pressable>
  );
}

function BadgeIconBtn({ badgeCount, onPress, theme, styles }: { badgeCount: number; onPress: () => void; theme: ThemeTokens; styles: ReturnType<typeof makeStyles> }) {
  const [size, setSize] = useState(0);
  const active = badgeCount > 0;
  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== size) setSize(w);
  }
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} onLayout={onLayout}>
      {size > 0 && <PixelButton size={size} fill={theme.bgElement} stroke={active ? theme.accent : theme.border} />}
      <Ionicons name="filter-outline" size={Math.max(16, Math.round(size * 0.45))} color={active ? theme.accent : theme.textMuted} />
      {badgeCount > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.bg }]}>{badgeCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

function NewsIconBtn({ unread, onPress, theme, styles }: { unread: number; onPress: () => void; theme: ThemeTokens; styles: ReturnType<typeof makeStyles> }) {
  const [size, setSize] = useState(0);
  const active = unread > 0;
  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== size) setSize(w);
  }
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} onLayout={onLayout}>
      {size > 0 && <PixelButton size={size} fill={theme.bgElement} stroke={active ? theme.accent : theme.border} />}
      <MaterialCommunityIcons name="newspaper-variant-outline" size={Math.max(16, Math.round(size * 0.45))} color={active ? theme.accent : theme.textMuted} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.danger }]}>
          <Text style={[styles.badgeText, { color: "#ffffff" }]}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── MenuRow (main sheet) ───────────────────────────────────────────────────

function MenuRow({ icon, label, value, active, onPress, theme, styles }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string; value: string; active: boolean; onPress: () => void;
  theme: ThemeTokens; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, { borderBottomColor: theme.bgDivider }, pressed && styles.optionPressed]}
      onPress={onPress}
    >
      <View style={styles.menuRowLeft}>
        <Ionicons name={icon} size={18} color={active ? theme.accent : theme.textMuted} />
        <Text style={[styles.menuLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <View style={styles.menuRowRight}>
        <Text style={[styles.menuValue, { color: active ? theme.accent : theme.textMuted }]} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
      </View>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

export function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container: {
      paddingTop: Spacing.six,
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.two,
      borderBottomWidth: 1,
    },
    row1: {
      flexDirection: "row",
      gap: Spacing.one,
      alignItems: "center",
    },
    searchWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      height: 38,
      gap: Spacing.one,
    },
    searchInput: {
      flex: 1,
      height: "100%",
    },
    iconBtn: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 3,
      right: 3,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize: ButtonFontSize.xxs,
      fontFamily: ButtonFont,
      lineHeight: 15,
    },
    chipsRow: {
      paddingTop: Spacing.two,
      paddingBottom: Spacing.one,
      gap: Spacing.one,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
    },
    chipText: {
      fontSize: ButtonFontSize.xs,
      fontFamily: ButtonFont,
    },
    // Slider
    sliderTrackOuter: {
      flex: 1,
      height: 28,
      justifyContent: "center",
    },
    sliderTrack: {
      flexDirection: "row",
      height: 4,
      borderRadius: 2,
      overflow: "hidden",
    },
    sliderFill: {
      borderRadius: 2,
    },
    sliderThumb: {
      position: "absolute",
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      marginLeft: -9, // center on position
      top: 5,
    },
    // Modal
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    sheet: {
      borderTopLeftRadius: BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
    },
    handleRow: {
      alignItems: "center",
      paddingVertical: Spacing.two,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.two,
      paddingBottom: Spacing.two,
      borderBottomWidth: 1,
    },
    headerSide: {
      width: 40,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: ButtonFontSize.lg,
      fontFamily: ButtonFont,
    },
    panelArea: {
      // height is animated inline (MAIN_MENU_HEIGHT for the menu, taller for sub-sheets)
      overflow: "hidden",
    },
    panel: {
      width: "100%",
      height: "100%",
    },
    panelAbsolute: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.three,
      height: 56,
      borderBottomWidth: 1,
    },
    menuRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
    menuRowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.one,
      maxWidth: "50%",
    },
    menuLabel: {
      fontSize: ButtonFontSize.lg,
      fontFamily: ButtonFont,
    },
    menuValue: {
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
      flexShrink: 1,
    },
    // Filter sub-sheet — categories side-by-side in columns (text options, not buttons)
    filterColumns: {
      flexDirection: "row",
      paddingHorizontal: Spacing.two,
      paddingTop: 8,
      gap: Spacing.one,
    },
    filterColumn: {
      flex: 1,
    },
    columnLabel: {
      fontSize: ButtonFontSize.sm,
      fontFamily: ButtonFont,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 4,
      paddingHorizontal: 6,
    },
    colOption: {
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: BorderRadius.sm,
    },
    option: {
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
    },
    optionPressed: { opacity: 0.7 },
    optionText: {
      fontSize: ButtonFontSize.lg,
      fontFamily: ButtonFont,
    },
    sortOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionLabel: {
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
      paddingHorizontal: Spacing.three,
      paddingTop: 10,
      paddingBottom: 4,
    },
    divider: { height: 1, marginVertical: 4 },
    pointsGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: Spacing.three,
      paddingBottom: 10,
      gap: 6,
    },
    pointChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
    },
    // Sheet bottom: view toggle + grid slider
    sheetBottom: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
    },
    sheetBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.three,
      marginTop: Spacing.one,
    },
    segmented: {
      flexDirection: "row",
      gap: Spacing.one,
    },
    segBtn: {
      width: 52,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
    },
    sheetSliderWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
  });
}

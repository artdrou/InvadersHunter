import { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, BorderRadius, ButtonFont, Spacing } from "@/constants/theme";
import { isFilterActive } from "@/features/map";
import type { MapFilter, FlashStatusFilter, FlashableFilter } from "@/features/map";
import type { SortOption, GroupMode } from "../utils/invader-list";
import { SORT_OPTIONS_BY_GROUP } from "../utils/invader-list";

const POINTS_OPTIONS = [10, 20, 30, 40, 50, 100];

const STATUS_OPTIONS: { key: FlashStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flashed", label: "Flashed" },
  { key: "unflashed", label: "Unflashed" },
];

const FLASHABLE_OPTIONS: { key: FlashableFilter; label: string }[] = [
  { key: "any", label: "Any" },
  { key: "flashable", label: "Flashable" },
  { key: "unflashable", label: "Unflashable" },
];

const GROUP_OPTIONS: { key: GroupMode; label: string }[] = [
  { key: "city",   label: "City" },
  { key: "points", label: "Points" },
  { key: "year",   label: "Year" },
];

const SORT_LABELS: Record<SortOption, string> = {
  number:      "#",
  points:      "Points",
  pose_date:   "Pose date",
  flash_date:  "Flash date",
  update_date: "Updated",
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  filter: MapFilter;
  onFilterChange: (f: MapFilter) => void;
  groupMode: GroupMode;
  onGroupModeChange: (g: GroupMode) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  viewMode: "list" | "grid";
  onToggleView: () => void;
};

export function InvaderSearchBar({
  value, onChange, filter, onFilterChange,
  groupMode, onGroupModeChange, sortBy, onSortChange,
  viewMode, onToggleView,
}: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupOpen,  setGroupOpen]  = useState(false);
  const [sortOpen,   setSortOpen]   = useState(false);

  const filterActive = isFilterActive(filter);
  const sortActive   = sortBy !== "number";

  const availableSorts = SORT_OPTIONS_BY_GROUP[groupMode].map((key) => ({
    key,
    label: SORT_LABELS[key],
  }));

  function closeAll() {
    setSearchOpen(false);
    setFilterOpen(false);
    setGroupOpen(false);
    setSortOpen(false);
  }

  function toggleSearch() { const was = searchOpen; closeAll(); setSearchOpen(!was); }
  function toggleFilter()  { const was = filterOpen; closeAll(); setFilterOpen(!was); }
  function toggleGroup()   { const was = groupOpen;  closeAll(); setGroupOpen(!was);  }
  function toggleSort()    { const was = sortOpen;   closeAll(); setSortOpen(!was);   }

  function togglePoint(pt: number) {
    const next = filter.points.includes(pt)
      ? filter.points.filter((p) => p !== pt)
      : [...filter.points, pt];
    onFilterChange({ ...filter, points: next });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, borderBottomColor: theme.bgDivider }]}>
      {/* Toolbar — 5 icons filling full width */}
      <View style={styles.toolbarRow}>
        <IconBtn name="search-outline"        active={searchOpen || value.length > 0} onPress={toggleSearch} theme={theme} styles={styles} />
        <IconBtn name="options-outline"       active={filterOpen || filterActive}     onPress={toggleFilter} theme={theme} styles={styles} />
        <IconBtn name="albums-outline"        active={groupOpen}                      onPress={toggleGroup}  theme={theme} styles={styles} />
        <IconBtn name="swap-vertical-outline" active={sortOpen || sortActive}         onPress={toggleSort}   theme={theme} styles={styles} />
        <IconBtn
          name={viewMode === "grid" ? "grid-outline" : "list-outline"}
          active={viewMode === "list"}
          onPress={onToggleView}
          theme={theme}
          styles={styles}
        />
      </View>

      {/* Search input */}
      {searchOpen && (
        <TextInput
          style={[styles.searchInput, {
            backgroundColor: theme.bgElement,
            color: theme.text,
            borderColor: theme.border,
            fontFamily: appFont,
            fontSize: sz(13),
          }]}
          placeholder="Search invaders…"
          placeholderTextColor={theme.textMuted}
          value={value}
          onChangeText={onChange}
          autoCapitalize="characters"
          autoCorrect={false}
          clearButtonMode="while-editing"
          autoFocus
        />
      )}

      {/* Filter panel */}
      {filterOpen && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.optionGroup}>
            {STATUS_OPTIONS.map((o) => {
              const selected = filter.status === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onFilterChange({ ...filter, status: o.key })}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Condition</Text>
          <View style={styles.optionGroup}>
            {FLASHABLE_OPTIONS.map((o) => {
              const selected = filter.flashable === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onFilterChange({ ...filter, flashable: o.key })}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Points</Text>
          <View style={styles.pointsGroup}>
            {POINTS_OPTIONS.map((pt) => {
              const selected = filter.points.includes(pt);
              return (
                <Pressable
                  key={pt}
                  style={({ pressed }) => [styles.pointChip, selected && styles.pointChipSelected, pressed && styles.optionPressed]}
                  onPress={() => togglePoint(pt)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{pt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Group panel */}
      {groupOpen && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Group by</Text>
          <View style={styles.optionGroup}>
            {GROUP_OPTIONS.map((o) => {
              const selected = groupMode === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onGroupModeChange(o.key)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Sort panel — options depend on current groupMode */}
      {sortOpen && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Sort by</Text>
          <View style={styles.optionGroup}>
            {availableSorts.map((o) => {
              const selected = sortBy === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onSortChange(o.key)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── internal ────────────────────────────────────────────────────────────────

type IconBtnProps = {
  name: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
  theme: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
};

function IconBtn({ name, active, onPress, theme, styles }: IconBtnProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.iconBtn, active && styles.iconBtnActive, pressed && styles.iconBtnPressed]}
      onPress={onPress}
    >
      <Ionicons name={name} size={18} color={active ? theme.bg : theme.textMuted} />
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container: {
      paddingTop: Spacing.six,
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.two,
      borderBottomWidth: 1,
    },
    toolbarRow: {
      flexDirection: "row",
      gap: Spacing.one,
    },
    iconBtn: {
      flex: 1,
      height: 36,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bgElement,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnActive: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    iconBtnPressed: {
      opacity: 0.7,
    },
    searchInput: {
      marginTop: Spacing.two,
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      height: 38,
    },
    panel: {
      marginTop: Spacing.two,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      overflow: "hidden",
    },
    sectionLabel: {
      color: t.textMuted,
      fontSize: 8,
      fontFamily: ButtonFont,
      paddingHorizontal: Spacing.three,
      paddingTop: 10,
      paddingBottom: 4,
    },
    optionGroup: {},
    option: {
      paddingHorizontal: Spacing.three,
      paddingVertical: 9,
    },
    optionSelected: {
      backgroundColor: t.accent,
    },
    optionPressed: {
      opacity: 0.7,
    },
    optionText: {
      color: t.text,
      fontSize: 10,
      fontFamily: ButtonFont,
    },
    optionTextSelected: {
      color: t.bg,
    },
    divider: {
      height: 1,
      backgroundColor: t.bgDivider,
      marginTop: 6,
    },
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
      borderColor: t.border,
    },
    pointChipSelected: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
  });
}

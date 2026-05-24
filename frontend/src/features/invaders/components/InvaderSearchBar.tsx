import { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, BorderRadius, ButtonFont, Spacing } from "@/constants/theme";
import { isFilterActive } from "@/features/map";
import type { MapFilter, FlashStatusFilter, FlashableFilter } from "@/features/map";
import { PixelButton } from "@/components/ui/pixel-button";
import type { SortOption, GroupMode } from "../utils/invader-list";
import { SORT_OPTIONS_BY_GROUP } from "../utils/invader-list";

const POINTS_OPTIONS = [10, 20, 30, 40, 50, 100];

const STATUS_KEYS: Record<FlashStatusFilter, string> = {
  all: "invaders.statusAll",
  flashed: "invaders.statusFlashed",
  unflashed: "invaders.statusUnflashed",
};

const FLASHABLE_KEYS: Record<FlashableFilter, string> = {
  any: "invaders.condAny",
  flashable: "invaders.condFlashable",
  unflashable: "invaders.condUnflashable",
};

const GROUP_KEYS: Record<GroupMode, string> = {
  city: "invaders.groupCity",
  points: "invaders.groupPoints",
  year: "invaders.groupYear",
};

const SORT_KEYS: Record<SortOption, string> = {
  number: "invaders.sortNumber",
  points: "invaders.sortPoints",
  pose_date: "invaders.sortPoseDate",
  flash_date: "invaders.sortFlashDate",
  update_date: "invaders.sortUpdated",
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
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const STATUS_OPTIONS: { key: FlashStatusFilter; label: string }[] = [
    { key: "all", label: t(STATUS_KEYS.all) },
    { key: "flashed", label: t(STATUS_KEYS.flashed) },
    { key: "unflashed", label: t(STATUS_KEYS.unflashed) },
  ];
  const FLASHABLE_OPTIONS: { key: FlashableFilter; label: string }[] = [
    { key: "any", label: t(FLASHABLE_KEYS.any) },
    { key: "flashable", label: t(FLASHABLE_KEYS.flashable) },
    { key: "unflashable", label: t(FLASHABLE_KEYS.unflashable) },
  ];
  const GROUP_OPTIONS: { key: GroupMode; label: string }[] = [
    { key: "city", label: t(GROUP_KEYS.city) },
    { key: "points", label: t(GROUP_KEYS.points) },
    { key: "year", label: t(GROUP_KEYS.year) },
  ];

  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupOpen,  setGroupOpen]  = useState(false);
  const [sortOpen,   setSortOpen]   = useState(false);

  const filterActive = isFilterActive(filter);
  const sortActive   = sortBy !== "number";

  const availableSorts = SORT_OPTIONS_BY_GROUP[groupMode].map((key) => ({
    key,
    label: t(SORT_KEYS[key]),
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
          placeholder={t('invaders.searchPlaceholder')}
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
          <Text style={styles.sectionLabel}>{t('invaders.filterStatus')}</Text>
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

          <Text style={styles.sectionLabel}>{t('invaders.filterCondition')}</Text>
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

          <Text style={styles.sectionLabel}>{t('invaders.filterPoints')}</Text>
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
          <Text style={styles.sectionLabel}>{t('invaders.groupBy')}</Text>
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
          <Text style={styles.sectionLabel}>{t('invaders.sortBy')}</Text>
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
  const [size, setSize] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== size) setSize(w);
  }

  return (
    <Pressable style={styles.iconBtn} onPress={onPress} onLayout={handleLayout}>
      {size > 0 && (
        <PixelButton
          size={size}
          fill={theme.bgElement}
          stroke={active ? theme.accent : theme.border}
        />
      )}
      <Ionicons
        name={name}
        size={Math.max(16, Math.round(size * 0.45))}
        color={active ? theme.accent : theme.textMuted}
      />
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
      aspectRatio: 1, // square — height matches width so 5 buttons fill the row
      alignItems: "center",
      justifyContent: "center",
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

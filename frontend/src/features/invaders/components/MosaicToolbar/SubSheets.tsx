import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeTokens } from "@/constants/theme";
import type { MapFilter, FlashStatusFilter, FlashableFilter } from "@/features/map/filter";
import type { SortOption, SortDir, GroupMode } from "../../utils/invader-list";
import type { ToolbarStyles } from "./styles";
import { SORT_KEYS, POINTS_OPTIONS } from "./constants";

type SubSheetHelpers = {
  theme: ThemeTokens;
  styles: ToolbarStyles;
  t: (k: string) => string;
};

export function SortSubSheet({
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

export function FilterSubSheet({ filter, onChange, theme, styles, t }: SubSheetHelpers & { filter: MapFilter; onChange: (f: MapFilter) => void }) {
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

export function GroupSubSheet({ groupMode, onChange, theme, styles, t }: SubSheetHelpers & { groupMode: GroupMode; onChange: (g: GroupMode) => void }) {
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

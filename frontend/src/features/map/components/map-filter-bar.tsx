import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, BorderRadius, ButtonFont, Spacing } from "@/constants/theme";
import { NON_FLASHABLE_STATES } from "@/features/invaders";

export type FlashStatusFilter = "all" | "flashed" | "unflashed";
export type FlashableFilter = "any" | "flashable" | "unflashable";

export type MapFilter = {
  status: FlashStatusFilter;
  flashable: FlashableFilter;
};

export const DEFAULT_FILTER: MapFilter = { status: "all", flashable: "any" };

export function isFilterActive(f: MapFilter) {
  return f.status !== "all" || f.flashable !== "any";
}

export function applyMapFilter(invaders: { isCaptured: boolean; state: string | null }[], filter: MapFilter) {
  return invaders.filter((i) => {
    if (filter.status === "flashed" && !i.isCaptured) return false;
    if (filter.status === "unflashed" && i.isCaptured) return false;
    if (filter.flashable === "flashable" && NON_FLASHABLE_STATES.includes(i.state ?? "")) return false;
    if (filter.flashable === "unflashable" && !NON_FLASHABLE_STATES.includes(i.state ?? "")) return false;
    return true;
  });
}

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

type Props = {
  value: MapFilter;
  onChange: (filter: MapFilter) => void;
};

export function MapFilterBar({ value, onChange }: Props) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const styles = makeStyles(theme);
  const active = isFilterActive(value);

  function buildLabel() {
    const parts: string[] = [];
    if (value.status !== "all") parts.push(value.status);
    if (value.flashable !== "any") parts.push(value.flashable);
    return parts.length > 0 ? parts.join(" · ") : "Filter";
  }

  return (
    <View style={styles.wrapper}>
      {open && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.optionGroup}>
            {STATUS_OPTIONS.map((o) => {
              const selected = value.status === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onChange({ ...value, status: o.key })}
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
              const selected = value.flashable === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onChange({ ...value, flashable: o.key })}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.btn, active && styles.btnActive, pressed && styles.btnPressed]}
        onPress={() => setOpen((v) => !v)}
      >
        <Text style={[styles.btnText, active && styles.btnTextActive]}>{buildLabel()}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    wrapper: {
      alignItems: "flex-start",
    },
    btn: {
      paddingHorizontal: Spacing.three,
      paddingVertical: 8,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bgElement,
    },
    btnActive: {
      borderColor: t.accent,
    },
    btnPressed: {
      opacity: 0.7,
    },
    btnText: {
      color: t.textMuted,
      fontSize: 10,
      fontFamily: ButtonFont,
    },
    btnTextActive: {
      color: t.accent,
    },
    panel: {
      marginBottom: 6,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      overflow: "hidden",
      minWidth: 140,
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
  });
}

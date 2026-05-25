import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, BorderRadius, ButtonFont, Spacing } from "@/constants/theme";
import { isNonFlashable } from "@/features/invaders/types";
import { PixelButton } from "@/components/ui/pixel-button";

export type FlashStatusFilter = "all" | "flashed" | "unflashed";
export type FlashableFilter = "any" | "flashable" | "unflashable";
export type GreyMode = "none" | "all" | "unflashed";
export type ColorMode = "flash" | "rarity";

export type MapFilter = {
  status: FlashStatusFilter;
  flashable: FlashableFilter;
  points: number[];
};

export const DEFAULT_FILTER: MapFilter = { status: "all", flashable: "any", points: [] };

export function isFilterActive(f: MapFilter) {
  return f.status !== "all" || f.flashable !== "any" || f.points.length > 0;
}

export function applyMapFilter<T extends { isCaptured: boolean; state: string | null; points?: number | null }>(
  invaders: T[],
  filter: MapFilter
): T[] {
  return invaders.filter((i) => {
    if (filter.status === "flashed" && !i.isCaptured) return false;
    if (filter.status === "unflashed" && i.isCaptured) return false;
    if (filter.flashable === "flashable" && isNonFlashable(i.state)) return false;
    if (filter.flashable === "unflashable" && !isNonFlashable(i.state)) return false;
    if (filter.points.length > 0 && !filter.points.includes(i.points ?? 0)) return false;
    return true;
  });
}

const POINTS_OPTIONS = [10, 20, 30, 40, 50, 100];

type Props = {
  value: MapFilter;
  onChange: (filter: MapFilter) => void;
  greyMode: GreyMode;
  onGreyModeChange: (v: GreyMode) => void;
  colorMode: ColorMode;
  onColorModeChange: (v: ColorMode) => void;
};

export function MapFilterBar({ value, onChange, greyMode, onGreyModeChange, colorMode, onColorModeChange }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const STATUS_OPTIONS: { key: FlashStatusFilter; label: string }[] = [
    { key: "all", label: t('invaders.statusAll') },
    { key: "flashed", label: t('invaders.statusFlashed') },
    { key: "unflashed", label: t('invaders.statusUnflashed') },
  ];
  const FLASHABLE_OPTIONS: { key: FlashableFilter; label: string }[] = [
    { key: "any", label: t('invaders.condAny') },
    { key: "flashable", label: t('invaders.condFlashable') },
    { key: "unflashable", label: t('invaders.condUnflashable') },
  ];
  const GREY_OPTIONS_FLASH: { key: GreyMode; label: string }[] = [
    { key: "all", label: t('invaders.greyAll') },
    { key: "unflashed", label: t('invaders.greyFlashed') },
    { key: "none", label: t('invaders.greyOff') },
  ];
  const GREY_OPTIONS_RARITY: { key: GreyMode; label: string }[] = [
    { key: "all", label: t('invaders.greyAll') },
    { key: "none", label: t('invaders.greyOff') },
  ];
  const COLOR_MODE_OPTIONS: { key: ColorMode; label: string }[] = [
    { key: "flash", label: t('invaders.colorFlash') },
    { key: "rarity", label: t('invaders.colorRarity') },
  ];
  const [filterOpen, setFilterOpen] = useState(false);
  const [greyOpen, setGreyOpen] = useState(false);
  const styles = makeStyles(theme);
  const filterActive = isFilterActive(value);
  // Default greyMode is "all" now — only flag accent when the user moved off the default.
  const greyActive = greyMode !== "all";
  const paletteActive = greyActive || colorMode !== "flash";

  function togglePoint(pt: number) {
    const next = value.points.includes(pt)
      ? value.points.filter((p) => p !== pt)
      : [...value.points, pt];
    onChange({ ...value, points: next });
  }

  function toggleGreyOpen() {
    setGreyOpen((v) => !v);
    setFilterOpen(false);
  }

  function toggleFilterOpen() {
    setFilterOpen((v) => !v);
    setGreyOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {greyOpen && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>{t('invaders.colorMode')}</Text>
          <View style={styles.optionGroup}>
            {COLOR_MODE_OPTIONS.map((o) => {
              const selected = colorMode === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onColorModeChange(o.key)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>{t('invaders.greyOut')}</Text>
          <View style={styles.optionGroup}>
            {(colorMode === "flash" ? GREY_OPTIONS_FLASH : GREY_OPTIONS_RARITY).map((o) => {
              const selected = greyMode === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                  onPress={() => onGreyModeChange(o.key)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Pressable style={styles.btn} onPress={toggleGreyOpen}>
        <PixelButton
          size={48}
          fill={theme.bgElement}
          stroke={paletteActive ? theme.accent : theme.border}
        />
        <Ionicons name="color-palette-outline" size={22} color={paletteActive ? theme.accent : theme.textMuted} />
      </Pressable>

      <View style={styles.gap} />

      {filterOpen && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>{t('invaders.filterStatus')}</Text>
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

          <Text style={styles.sectionLabel}>{t('invaders.filterCondition')}</Text>
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

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>{t('invaders.filterPoints')}</Text>
          <View style={styles.pointsGroup}>
            {POINTS_OPTIONS.map((pt) => {
              const selected = value.points.includes(pt);
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

      <Pressable style={styles.btn} onPress={toggleFilterOpen}>
        <PixelButton
          size={48}
          fill={theme.bgElement}
          stroke={filterActive ? theme.accent : theme.border}
        />
        <Ionicons name="options-outline" size={22} color={filterActive ? theme.accent : theme.textMuted} />
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
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
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
    gap: {
      height: 6,
    },
  });
}

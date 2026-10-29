import { useState, useMemo, useImperativeHandle, type Ref } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, Spacing, FontSize } from "@/constants/theme";
import { ARCADE_SHADOW, arcadeButton, arcadeButtonLabel, arcadeCard, arcadeRowDivider, arcadeSectionLabel, arcadePixelButton } from "@/constants/arcade-button";
import { PixelButton } from "@/components/ui/PixelButton";
import { ShadowIcon } from "@/components/ShadowIcon";
import { InfoButton, TutorialModal } from "@/features/tutorial";
import type { TutorialPage } from "@/features/tutorial";
import { ColorModeIllustration } from "./ColorModeIllustration";
import { GreyModeIllustration } from "./GreyModeIllustration";
import { FilterIllustration } from "./FilterIllustration";
import type { MapFilter, GreyMode, ColorMode, FlashStatusFilter, FlashableFilter } from "../filter";
import { isFilterActive } from "../filter";

const POINTS_OPTIONS = [10, 20, 30, 40, 50, 100];

export type MapFilterBarHandle = {
  /** Close the filter / palette panels. */
  closePanels: () => void;
};

type Props = {
  ref?: Ref<MapFilterBarHandle>;
  value: MapFilter;
  onChange: (filter: MapFilter) => void;
  greyMode: GreyMode;
  onGreyModeChange: (v: GreyMode) => void;
  colorMode: ColorMode;
  onColorModeChange: (v: ColorMode) => void;
};

export function MapFilterBar({ ref, value, onChange, greyMode, onGreyModeChange, colorMode, onColorModeChange }: Props) {
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
    { key: "state", label: t('invaders.colorState') },
  ];
  const [filterOpen, setFilterOpen] = useState(false);
  const [greyOpen, setGreyOpen] = useState(false);
  const [colorTutVisible, setColorTutVisible] = useState(false);
  const [greyTutVisible, setGreyTutVisible] = useState(false);
  const [filterTutVisible, setFilterTutVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    closePanels: () => { setFilterOpen(false); setGreyOpen(false); },
  }), []);

  const filterPages = useMemo<TutorialPage[]>(() => [
    {
      key: 'filters',
      tab: t('tutorial.filters.title'),
      items: [
        { type: 'section', label: t('invaders.filterStatus'), body: t('tutorial.filters.statusBody') },
        { type: 'section', label: t('invaders.filterCondition'), body: t('tutorial.filters.condBody') },
        { type: 'section', label: t('invaders.filterPoints'), body: t('tutorial.filters.pointsBody') },
        { type: 'node', content: <FilterIllustration /> },
        { type: 'tip', body: t('tutorial.filters.combineTip') },
      ],
    },
  ], [t]);

  const colorPages = useMemo<TutorialPage[]>(() => [
    {
      key: 'colorMode',
      tab: t('tutorial.colorMode.title'),
      items: [
        { type: 'section', label: t('invaders.colorFlash'), body: t('tutorial.colorMode.flashBody') },
        { type: 'section', label: t('invaders.colorRarity'), body: t('tutorial.colorMode.rarityBody') },
        { type: 'section', label: t('invaders.colorState'), body: t('tutorial.colorMode.stateBody') },
        { type: 'node', content: <ColorModeIllustration /> },
      ],
    },
  ], [t]);

  const greyPages = useMemo<TutorialPage[]>(() => [
    {
      key: 'greyMode',
      tab: t('tutorial.greyMode.title'),
      items: [
        { type: 'section', label: t('invaders.greyAll'), body: t('tutorial.greyMode.allBody') },
        { type: 'section', label: t('invaders.greyFlashed'), body: t('tutorial.greyMode.flashedBody') },
        { type: 'section', label: t('invaders.greyOff'), body: t('tutorial.greyMode.offBody') },
        { type: 'node', content: <GreyModeIllustration /> },
      ],
    },
  ], [t]);

  const styles = useThemedStyles(makeStyles);
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
    <>
    <View style={styles.wrapper}>
      {greyOpen && (
        <View style={styles.panel}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabelText}>{t('invaders.colorMode')}</Text>
            <InfoButton size={14} onPress={() => setColorTutVisible(true)} color={theme.accent} showLabel={false} />
          </View>
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

          {/* State mode already colors destroyed / not visible invaders: nothing to dim */}
          {colorMode !== "state" && (<>
          <View style={styles.divider} />
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabelText}>{t('invaders.greyOut')}</Text>
            <InfoButton size={14} onPress={() => setGreyTutVisible(true)} color={theme.accent} showLabel={false} />
          </View>
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
          </>)}
        </View>
      )}

      <Pressable style={styles.btn} onPress={toggleGreyOpen}>
        <PixelButton
          size={48}
          {...arcadePixelButton(theme, paletteActive).button}
        />
        <ShadowIcon name="color-palette-outline" size={22} color={arcadePixelButton(theme, paletteActive).icon} shadowColor={arcadePixelButton(theme, paletteActive).iconShadow} />
      </Pressable>

      <View style={styles.gap} />

      {filterOpen && (
        <View style={styles.panel}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabelText}>{t('invaders.filterStatus')}</Text>
            <InfoButton size={14} onPress={() => setFilterTutVisible(true)} color={theme.accent} showLabel={false} />
          </View>
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
          {...arcadePixelButton(theme, filterActive).button}
        />
        <ShadowIcon name="options-outline" size={22} color={arcadePixelButton(theme, filterActive).icon} shadowColor={arcadePixelButton(theme, filterActive).iconShadow} />
      </Pressable>
    </View>
    <TutorialModal
      visible={colorTutVisible}
      onClose={() => setColorTutVisible(false)}
      title={t('tutorial.colorMode.title')}
      pages={colorPages}
    />
    <TutorialModal
      visible={greyTutVisible}
      onClose={() => setGreyTutVisible(false)}
      title={t('tutorial.greyMode.title')}
      pages={greyPages}
    />
    <TutorialModal
      visible={filterTutVisible}
      onClose={() => setFilterTutVisible(false)}
      title={t('tutorial.filters.title')}
      pages={filterPages}
    />
    </>
  );
}

// Arcade look (settings screens): thick-bordered card with a hard shadow, accent
// capital section titles, dotted dividers, selection = filled arcade button.
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
      ...arcadeCard(t),
      marginBottom: 6 + ARCADE_SHADOW,
      paddingBottom: Spacing.two,
      minWidth: 170,
    },
    sectionLabel: {
      ...arcadeSectionLabel(t),
      paddingHorizontal: Spacing.three,
      paddingTop: 10,
      paddingBottom: 6,
    },
    sectionRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingTop: 10,
      paddingBottom: 6,
    },
    sectionLabelText: arcadeSectionLabel(t),
    optionGroup: {
      paddingHorizontal: Spacing.two,
      gap: 4,
    },
    option: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 7,
      borderRadius: 4,
      // Room for the selected option's offset shadow
      marginRight: ARCADE_SHADOW,
    },
    optionSelected: arcadeButton(t),
    optionPressed: {
      opacity: 0.7,
    },
    optionText: {
      color: t.text,
      fontSize: FontSize.lg,
      fontFamily: ButtonFont,
    },
    optionTextSelected: arcadeButtonLabel(t),
    divider: {
      ...arcadeRowDivider(t),
      marginTop: Spacing.two,
      marginHorizontal: Spacing.two,
    },
    pointsGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: Spacing.three,
      gap: 8,
    },
    pointChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: t.border,
    },
    pointChipSelected: {
      ...arcadeButton(t),
      // keep the outline's footprint so chips don't shift when toggled
      borderWidth: 2,
      borderColor: t.accent,
    },
    gap: {
      height: 6,
    },
  });
}

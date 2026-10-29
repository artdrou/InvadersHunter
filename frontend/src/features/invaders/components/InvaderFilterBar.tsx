import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, ButtonFont, FontSize } from "@/constants/theme";
import { ARCADE_SHADOW, arcadeButton, arcadeButtonLabel } from "@/constants/arcade-button";
import type { MapFilter, FlashStatusFilter, FlashableFilter } from "@/features/map/filter";

type Props = {
  filter: MapFilter;
  onChange: (f: MapFilter) => void;
};

export function InvaderFilterBar({ filter, onChange }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const STATUS_OPTIONS: { key: FlashStatusFilter; label: string }[] = [
    { key: "all",       label: t('invaders.statusAll') },
    { key: "flashed",   label: t('invaders.statusFlashed') },
    { key: "unflashed", label: t('invaders.statusUnflashed') },
  ];
  const CONDITION_OPTIONS: { key: FlashableFilter; label: string }[] = [
    { key: "any",         label: t('invaders.condAny') },
    { key: "flashable",   label: t('invaders.condFlashable') },
    { key: "unflashable", label: t('invaders.condUnflashable') },
  ];

  return (
    <View style={[styles.bar, { backgroundColor: theme.bg, borderBottomColor: theme.bgDivider }]}>
      <PillRow
        options={STATUS_OPTIONS}
        selected={filter.status}
        onSelect={(key) => onChange({ ...filter, status: key as FlashStatusFilter })}
      />
      <PillRow
        options={CONDITION_OPTIONS}
        selected={filter.flashable}
        onSelect={(key) => onChange({ ...filter, flashable: key as FlashableFilter })}
      />
    </View>
  );
}

// ─── internal helper ─────────────────────────────────────────────────────────

function PillRow({ options, selected, onSelect }: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = selected === o.key;
        return (
          <Pressable
            key={o.key}
            // Same chips as the map filter window: outlined, the selected one a filled arcade button
            style={[styles.pill, { borderColor: theme.border }, active && [arcadeButton(theme), { borderWidth: 2, borderColor: theme.accent }]]}
            onPress={() => onSelect(o.key)}
          >
            <Text style={[styles.pillText, { color: theme.textMuted, fontFamily: ButtonFont, fontSize: FontSize.lg }, active && arcadeButtonLabel(theme)]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    gap: Spacing.one,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingBottom: ARCADE_SHADOW,   // room for the selected chip's offset shadow
  },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 2,
  },
  pillText: {},
});

import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, FontSize, ButtonFontBold } from "@/constants/theme";
import { arcadeShadow, flashedColors } from '@/constants/arcade-button';

type Props = {
  city: string;
  capturedCount: number;
  total: number;
  expanded: boolean;
  /** Without it the row is a plain summary (the total on top): not tappable, no arrow. */
  onPress?: () => void;
};

/** City codes are up to 5 characters: every chip gets that width, so the bars line up. */
const CHIP_CHARS = 5;
const BOLD_ADVANCE = 0.5625;  // FreePixel Bold glyph width, in em
const CHIP_PAD = 6;
const LETTER_SPACING = 1;
/** Counts up to "9999/9999": fixed width, so the bars end at the same place too. */
const COUNT_CHARS = 9;
const REGULAR_ADVANCE = 0.5;  // FreePixel glyph width, in em

export function CityHeader({ city, capturedCount, total, expanded, onPress }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const pct = total > 0 ? (capturedCount / total) * 100 : 0;
  const chipFont = sz(13);
  const chipWidth = Math.ceil(CHIP_CHARS * (chipFont * BOLD_ADVANCE + LETTER_SPACING)) + 2 * CHIP_PAD;
  // Same label colours as the Flash button: shadow pink, light text on the light themes' dark accent
  const chipText = theme.isLight ? theme.bg : theme.titleShadow;
  const complete = total > 0 && capturedCount === total;
  const flashedInk = flashedColors(theme).ink;

  return (
    <Pressable
      style={[styles.row, { borderBottomColor: theme.bgDivider, backgroundColor: theme.bgElement }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.chip, { minWidth: chipWidth, backgroundColor: theme.accent, boxShadow: arcadeShadow(theme, 2) }]}>
        <Text style={[styles.chipText, { color: chipText, fontFamily: ButtonFontBold, fontSize: chipFont }]} numberOfLines={1}>
          {city}
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: theme.bgDivider }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: flashedInk }]} />
      </View>
      <Text style={[styles.count, { minWidth: Math.ceil(COUNT_CHARS * REGULAR_ADVANCE * sz(13)), color: complete ? flashedInk : theme.accent, fontFamily: appFont, fontSize: sz(13) }]}>
        {capturedCount}/{total}
      </Text>
      <Text style={[styles.chevron, { color: theme.textMuted }]}>
        {onPress ? (expanded ? "▲" : "▼") : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  chip: { paddingHorizontal: CHIP_PAD, paddingVertical: 2, maxWidth: "40%", alignItems: "center" },
  chipText: { letterSpacing: LETTER_SPACING },
  bar: { flex: 1, height: 8 },
  barFill: { height: "100%" },
  count: { textAlign: "right" },
  chevron: { fontSize: FontSize.xs, width: 14, textAlign: "center" },
});

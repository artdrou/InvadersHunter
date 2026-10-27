import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, FontSize, ButtonFontBold } from "@/constants/theme";
import { arcadeShadow, flashedColors } from "@/constants/arcade-button";

type Props = {
  capturedCount: number;
  total: number;
};

/**
 * Overall count on top of the grouped list. A banner, not a group row (no chip, big
 * number, thick bar, accent rule under it), so it doesn't read as one more city.
 */
export function TotalHeader({ capturedCount, total }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const pct = total > 0 ? (capturedCount / total) * 100 : 0;
  const ink = flashedColors(theme).ink;

  return (
    <View style={[styles.banner, { backgroundColor: theme.bg, borderBottomColor: theme.accent }]}>
      <View style={styles.top}>
        <Text style={[styles.label, { color: theme.accent, fontFamily: ButtonFontBold, fontSize: sz(14) }]}>
          {t('invaders.total')}
        </Text>
        <Text style={{ color: ink, fontFamily: ButtonFontBold, fontSize: sz(22) }}>
          {capturedCount}
          <Text style={{ color: theme.textMuted, fontFamily: appFont, fontSize: sz(14) }}> / {total}</Text>
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: theme.bgDivider, boxShadow: arcadeShadow(theme, 2) }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: ink }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: 3,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  label: { letterSpacing: 2 },
  bar: { height: 12 },
  barFill: { height: "100%" },
});

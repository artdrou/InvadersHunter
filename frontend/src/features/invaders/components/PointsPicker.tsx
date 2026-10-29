import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize } from "@/constants/theme";
import { ARCADE_SHADOW, arcadeButton, arcadeButtonLabel } from "@/constants/arcade-button";

export const POINT_OPTIONS = [10, 20, 30, 40, 50, 100] as const;

type Props = {
  value: number | null;
  /** Tapping the selected value clears it (null). */
  onChange: (points: number | null) => void;
};

/** Points picker shared by the invader create and edit forms (one row of values). */
export function PointsPicker({ value, onChange }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  return (
    <View style={styles.row}>
      {POINT_OPTIONS.map((p) => {
        const selected = value === p;
        return (
          <Pressable
            key={p}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(selected ? null : p)}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{p}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Same chips as the map filter window: outlined, the selected one a filled arcade button
function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    // Room for the selected chip's offset shadow
    row: { flexDirection: "row", gap: 5, paddingBottom: ARCADE_SHADOW },
    option: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: t.border,
      alignItems: "center",
    },
    // keep the outline's footprint so chips don't shift when toggled
    optionSelected: { ...arcadeButton(t), borderWidth: 2, borderColor: t.accent },
    optionText: { color: t.textMuted, fontSize: sz(FontSize.sm), fontFamily: font },
    optionTextSelected: { ...arcadeButtonLabel(t), fontSize: sz(FontSize.sm) },
  });
}

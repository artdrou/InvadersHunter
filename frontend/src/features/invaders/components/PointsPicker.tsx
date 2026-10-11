import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius } from "@/constants/theme";

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

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    row: { flexDirection: "row", gap: 5 },
    option: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center",
    },
    optionSelected: { borderColor: t.accent, backgroundColor: t.bg },
    optionText: { color: t.textMuted, fontSize: sz(FontSize.sm), fontFamily: font },
    optionTextSelected: { color: t.accent, fontFamily: font },
  });
}

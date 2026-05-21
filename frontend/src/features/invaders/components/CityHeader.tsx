import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { Spacing } from "@/constants/theme";

type Props = {
  city: string;
  capturedCount: number;
  total: number;
  expanded: boolean;
  onPress: () => void;
};

export function CityHeader({ city, capturedCount, total, expanded, onPress }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  return (
    <Pressable
      style={[styles.row, { borderBottomColor: theme.bgDivider, backgroundColor: theme.bgElement }]}
      onPress={onPress}
    >
      <Text style={[styles.cityName, { color: theme.accent, fontFamily: appFont, fontSize: sz(17) }]}>
        {city}
      </Text>
      <Text style={[styles.count, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(13) }]}>
        {capturedCount}/{total}
      </Text>
      <Text style={[styles.chevron, { color: theme.textMuted }]}>
        {expanded ? "▲" : "▼"}
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
  cityName: { flex: 1, letterSpacing: 1 },
  count: {},
  chevron: { fontSize: 12, width: 14, textAlign: "center" },
});

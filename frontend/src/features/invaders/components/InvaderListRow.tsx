import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { Spacing } from "@/constants/theme";
import type { InvaderWithState } from "../types";

type Props = {
  invader: InvaderWithState;
  expanded: boolean;
  onPress: () => void;
};

export function InvaderListRow({ invader, expanded, onPress }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  return (
    <Pressable
      style={[styles.row, { backgroundColor: expanded ? theme.bgElement : theme.bg }]}
      onPress={onPress}
    >
      <Text style={[styles.name, { color: invader.isCaptured ? theme.success : theme.text, fontFamily: appFont, fontSize: sz(13) }]}>
        {invader.name}
      </Text>
      <View style={styles.meta}>
        {invader.points != null && (
          <Text style={[styles.points, { color: theme.textMuted, fontFamily: appFont }]}>
            {invader.points}pts
          </Text>
        )}
        {invader.isCaptured && (
          <Text style={{ color: invader.isPending ? theme.textMuted : theme.success, fontFamily: appFont, fontSize: 13 }}>
            {invader.isPending ? "…" : "✓"}
          </Text>
        )}
        <Text style={[styles.chevron, { color: theme.textMuted }]}>
          {expanded ? "▲" : "▼"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three + Spacing.two,
    paddingVertical: Spacing.two + 2,
  },
  name: { flex: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  points: { fontSize: 11 },
  chevron: { fontSize: 10, width: 14, textAlign: "center" },
});

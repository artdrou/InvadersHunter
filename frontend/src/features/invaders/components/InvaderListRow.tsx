import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, FontSize } from "@/constants/theme";
import type { InvaderWithState } from "../types";

type Props = {
  invader: InvaderWithState;
  expanded: boolean;
  onPress: () => void;
};

// Arcade score-table leader ("PA_1038 ....... 20"), clipped to the room left
const LEADER = " " + ".".repeat(80);

export function InvaderListRow({ invader, expanded, onPress }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const nameColor = invader.isPending ? theme.textMuted : invader.isCaptured ? theme.success : theme.text;

  return (
    <Pressable
      style={[styles.row, { backgroundColor: expanded ? theme.bgElement : theme.bg }]}
      onPress={onPress}
    >
      <Text style={[styles.mark, { color: invader.isCaptured ? nameColor : theme.textMuted, fontFamily: appFont }]}>
        {invader.isCaptured ? "✓" : "·"}
      </Text>
      <Text style={[styles.name, { color: nameColor, fontFamily: appFont, fontSize: sz(13) }]} numberOfLines={1} ellipsizeMode="clip">
        {invader.name}
        <Text style={{ color: theme.bgDivider }}>{LEADER}</Text>
      </Text>
      <View style={styles.meta}>
        <Text style={[styles.points, { color: theme.accent, fontFamily: appFont, fontSize: sz(13) }]}>
          {invader.points ?? "--"}
        </Text>
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.two,
  },
  mark: { fontSize: FontSize.xs, width: 14, textAlign: "center" },
  name: { flex: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  points: {},
  chevron: { fontSize: FontSize.xxs, width: 14, textAlign: "center" },
});

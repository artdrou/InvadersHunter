import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeTokens } from "@/constants/theme";
import type { ToolbarStyles } from "./styles";

/** A row in the toolbar's main menu: icon + label on the left, current value + chevron on the right. */
export function MenuRow({ icon, label, value, active, onPress, theme, styles }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string; value: string; active: boolean; onPress: () => void;
  theme: ThemeTokens; styles: ToolbarStyles;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, { borderBottomColor: theme.bgDivider }, pressed && styles.optionPressed]}
      onPress={onPress}
    >
      <View style={styles.menuRowLeft}>
        <Ionicons name={icon} size={18} color={active ? theme.accent : theme.textMuted} />
        <Text style={[styles.menuLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <View style={styles.menuRowRight}>
        <Text style={[styles.menuValue, { color: active ? theme.accent : theme.textMuted }]} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
      </View>
    </Pressable>
  );
}

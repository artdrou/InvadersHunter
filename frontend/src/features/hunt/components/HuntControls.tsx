import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/theme-context";
import { BorderRadius, FontSize, Spacing, ZIndex } from "@/constants/theme";
import { arcadeButton, arcadeButtonLabel, arcadeLabelColor } from "@/constants/arcade-button";

/** "Go": enters the hunt view once a route is drawn. */
export function HuntGoButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <View style={styles.goWrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.btn, arcadeButton(theme), pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="walk" size={20} color={arcadeLabelColor(theme)} />
        <Text style={[styles.label, arcadeButtonLabel(theme)]}>{t("hunt.go")}</Text>
      </Pressable>
    </View>
  );
}

type BarProps = {
  /** The user moved the map: offer to follow again. */
  paused: boolean;
  onRecenter: () => void;
  onExit: () => void;
};

/** Hunt view controls, at the bottom (the tab bar is hidden while hunting). */
export function HuntBar({ paused, onRecenter, onExit }: BarProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + Spacing.four }]} pointerEvents="box-none">
      {paused && (
        <Pressable
          onPress={onRecenter}
          style={({ pressed }) => [styles.btn, arcadeButton(theme), pressed && styles.pressed]}
        >
          <Ionicons name="navigate" size={18} color={arcadeLabelColor(theme)} />
          <Text style={[styles.label, arcadeButtonLabel(theme)]}>{t("hunt.recenter")}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onExit}
        style={({ pressed }) => [styles.btn, arcadeButton(theme, "danger"), { backgroundColor: theme.bg }, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={18} color={arcadeLabelColor(theme, "danger")} />
        <Text style={[styles.label, arcadeButtonLabel(theme, "danger")]}>{t("hunt.exit")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  goWrap: {
    position: "absolute",
    bottom: 140, // level with the routing button
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: ZIndex.map,
  },
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.three,
    zIndex: ZIndex.control,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
    borderRadius: BorderRadius.sm,
  },
  label: { fontSize: FontSize.md },
  pressed: { opacity: 0.7 },
});

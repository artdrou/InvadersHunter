import { View, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { ZIndex } from "@/constants/theme";

/**
 * A pin fixed at the screen center that the user aligns by panning the map.
 * Shared by every "pick a point on the map" flow (modify location, create
 * invader, routing endpoints). Non-interactive — the map underneath receives touches.
 */
export function CenterPin() {
  const { theme } = useTheme();
  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={[styles.pin, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
      <View style={[styles.stem, { backgroundColor: theme.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: ZIndex.picker,
  },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginBottom: 18,
  },
  stem: {
    position: "absolute",
    width: 2,
    height: 10,
    top: "50%",
    marginTop: -1,
  },
});

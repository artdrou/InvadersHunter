import { Animated, Text, StyleSheet } from "react-native";
import { Overlay, White, BorderRadius, FontSize, ZIndex } from "@/constants/theme";

type Props = {
  opacity: Animated.Value;
  message: string;
};

/** Bottom-centered transient toast on the map (bind `opacity` from useToast). */
export function MapToast({ opacity, message }: Props) {
  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: Overlay.scrimStrong,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.pill,
    zIndex: ZIndex.overlay,
  },
  text: {
    color: White,
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
});

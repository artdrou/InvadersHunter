import type { ReactNode } from "react";
import { View } from "react-native";
import type { PopupStyles } from "./styles";

type Props = {
  styles: PopupStyles;
  onHeightChange?: (height: number) => void;
  children: ReactNode;
};

/**
 * Shared popup chrome for both view and edit modes: reports its measured height
 * (so the map can offset the camera) and draws the downward pointer arrow.
 */
export function PopupShell({ styles, onHeightChange, children }: Props) {
  return (
    <View onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
      <View style={styles.container}>{children}</View>
      <View style={styles.arrow} />
    </View>
  );
}

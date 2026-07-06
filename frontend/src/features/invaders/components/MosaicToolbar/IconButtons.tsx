import { useState } from "react";
import { Text, View, Pressable, type LayoutChangeEvent } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ThemeTokens } from "@/constants/theme";
import { White } from "@/constants/theme";
import { PixelButton } from "@/components/ui/PixelButton";
import type { ToolbarStyles } from "./styles";

type IconBtnProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
  theme: ThemeTokens;
  styles: ToolbarStyles;
};

// The pixel-button background is drawn to match the measured square size, so each
// button tracks its own layout width and only renders the frame once measured.
function useSquareSize() {
  const [size, setSize] = useState(0);
  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== size) setSize(w);
  }
  return { size, onLayout };
}

export function SquareIconBtn({ icon, active, onPress, theme, styles }: IconBtnProps) {
  const { size, onLayout } = useSquareSize();
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} onLayout={onLayout}>
      {size > 0 && <PixelButton size={size} fill={theme.bgElement} stroke={active ? theme.accent : theme.border} />}
      <Ionicons name={icon} size={Math.max(16, Math.round(size * 0.45))} color={active ? theme.accent : theme.textMuted} />
    </Pressable>
  );
}

export function BadgeIconBtn({ badgeCount, onPress, theme, styles }: { badgeCount: number; onPress: () => void; theme: ThemeTokens; styles: ToolbarStyles }) {
  const { size, onLayout } = useSquareSize();
  const active = badgeCount > 0;
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} onLayout={onLayout}>
      {size > 0 && <PixelButton size={size} fill={theme.bgElement} stroke={active ? theme.accent : theme.border} />}
      <Ionicons name="filter-outline" size={Math.max(16, Math.round(size * 0.45))} color={active ? theme.accent : theme.textMuted} />
      {badgeCount > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.bg }]}>{badgeCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function NewsIconBtn({ unread, onPress, theme, styles }: { unread: number; onPress: () => void; theme: ThemeTokens; styles: ToolbarStyles }) {
  const { size, onLayout } = useSquareSize();
  const active = unread > 0;
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} onLayout={onLayout}>
      {size > 0 && <PixelButton size={size} fill={theme.bgElement} stroke={active ? theme.accent : theme.border} />}
      <MaterialCommunityIcons name="newspaper-variant-outline" size={Math.max(16, Math.round(size * 0.45))} color={active ? theme.accent : theme.textMuted} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.danger }]}>
          <Text style={[styles.badgeText, { color: White }]}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

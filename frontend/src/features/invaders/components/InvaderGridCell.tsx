import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/contexts/theme-context";
import { BorderRadius, ButtonFontBold } from "@/constants/theme";
import type { InvaderWithState } from "../types";
import { arcadeShadow } from '@/constants/arcade-button';

type Props = {
  invader: InvaderWithState;
  size: number;
  selected: boolean;
  onPress: () => void;
};

export function InvaderGridCell({ invader, size, selected, onPress }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  // Flashed: thick accent border + arcade offset shadow (theme colours, not green)
  const flashed = invader.isCaptured && !invader.isPending;
  const borderColor = selected || flashed
    ? theme.accent
    : invader.isPending
    ? theme.textMuted
    : theme.border;
  const frame = {
    borderColor,
    borderWidth: flashed ? 3 : selected ? 2 : 1,
    boxShadow: flashed ? arcadeShadow(theme) : undefined,
  };

  const labelColor = selected || flashed ? theme.accent : theme.textMuted;

  return (
    <Pressable style={styles.cell} onPress={onPress}>
      {invader.image_url ? (
        <Image
          source={invader.image_url}
          recyclingKey={String(invader.id)}
          style={[styles.image, frame, { width: size, height: size, backgroundColor: theme.bgElement }]}
          contentFit="cover"
          priority="low"
          transition={150}
        />
      ) : (
        <View style={[styles.placeholder, frame, { width: size, height: size, backgroundColor: theme.bgElement }]} />
      )}
      <Text numberOfLines={1} style={[styles.label, { color: labelColor, fontFamily: flashed ? ButtonFontBold : appFont, fontSize: sz(10) }]}>
        {invader.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { marginBottom: 2 },
  image: {
    borderRadius: BorderRadius.sm,
  },
  placeholder: {
    borderRadius: BorderRadius.sm,
  },
  label: {
    marginTop: 3,
    textAlign: "center",
  },
});

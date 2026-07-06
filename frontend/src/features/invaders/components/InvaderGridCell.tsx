import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/contexts/theme-context";
import { BorderRadius } from "@/constants/theme";
import type { InvaderWithState } from "../types";

type Props = {
  invader: InvaderWithState;
  size: number;
  selected: boolean;
  onPress: () => void;
};

export function InvaderGridCell({ invader, size, selected, onPress }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  const borderColor = selected
    ? theme.accent
    : invader.isPending
    ? theme.textMuted
    : invader.isCaptured
    ? theme.success
    : theme.border;

  const labelColor = selected
    ? theme.accent
    : invader.isPending
    ? theme.textMuted
    : invader.isCaptured
    ? theme.success
    : theme.textMuted;

  return (
    <Pressable style={styles.cell} onPress={onPress}>
      {invader.image_url ? (
        <Image
          source={invader.image_url}
          recyclingKey={String(invader.id)}
          style={[styles.image, { width: size, height: size, borderColor, backgroundColor: theme.bgElement }]}
          contentFit="cover"
          priority="low"
          transition={150}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderColor, backgroundColor: theme.bgElement }]} />
      )}
      <Text numberOfLines={1} style={[styles.label, { color: labelColor, fontFamily: appFont, fontSize: sz(10) }]}>
        {invader.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { marginBottom: 2 },
  image: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  placeholder: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  label: {
    marginTop: 3,
    textAlign: "center",
  },
});

import { Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius } from "@/constants/theme";
import { hapticTap } from "@/features/settings";

type Props = {
  onPress: () => void;
  /** Defaults to "+ Ajouter". */
  label?: string;
};

/** Small "+ Add" pill that fits at the end of an info line whose value is missing. */
export function MissingChip({ onPress, label }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  return (
    <Pressable
      onPress={() => { hapticTap(); onPress(); }}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{label ?? t("popup.addMissing")}</Text>
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    text: { color: t.accent, fontSize: sz(FontSize.xxs), fontFamily: font },
    pressed: { opacity: 0.6 },
  });
}

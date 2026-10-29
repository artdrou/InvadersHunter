import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize } from "@/constants/theme";
import { arcadeButton, arcadeButtonLabel, arcadeShadow } from "@/constants/arcade-button";
import { ShadowText } from "@/components/ShadowText";
import { hapticTap } from "@/features/settings";

type Props = {
  onPress: () => void;
  /** Defaults to "+ Ajouter". */
  label?: string;
};

/** Small "+ Add" arcade outline chip that fits at the end of an info line whose value is missing. */
export function MissingChip({ onPress, label }: Props) {
  const { t } = useTranslation();
  const { theme, fontScale } = useTheme();
  const styles = makeStyles(theme, fontScale);
  return (
    <Pressable
      onPress={() => { hapticTap(); onPress(); }}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <ShadowText shadowColor={theme.titleShadow} offset={1} style={styles.text}>{label ?? t("popup.addMissing")}</ShadowText>
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    chip: {
      ...arcadeButton(t, "outline"),
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 0,
      // Smaller offset shadow than full-size buttons: this chip sits inside a text line
      boxShadow: arcadeShadow(t, 2),
    },
    text: { ...arcadeButtonLabel(t, "outline"), fontSize: sz(FontSize.xxs) },
    pressed: { opacity: 0.6 },
  });
}

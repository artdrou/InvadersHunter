import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, BorderRadius, FontSize, ZIndex } from "@/constants/theme";
import { CenterPin } from "./CenterPin";
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';

type Props = {
  onCreate: () => void;
  /** Place an existing invader that has no position yet on this spot. */
  onAddLocation: () => void;
  onCancel: () => void;
};

/**
 * First step of the create-invader flow: a {@link CenterPin} the user drops on
 * the spot, plus a small "Create here" card offering to open the full form — or
 * to give this spot to an existing invader that isn't on the map yet.
 */
export function CreateHerePopup({ onCreate, onAddLocation, onCancel }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <>
      <CenterPin />
      <View style={styles.wrapper} pointerEvents="box-none">
        <View style={[styles.card, arcadeCard(theme)]}>
          <Text style={[styles.label, { color: theme.text }]}>{t("map.createHere")}</Text>
          <TouchableOpacity style={[styles.btn, arcadeButton(theme)]} onPress={onCreate}>
            <Text style={[styles.btnText, arcadeButtonLabel(theme)]}>{t("map.createBtn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, arcadeButton(theme, 'outline')]} onPress={onAddLocation}>
            <ShadowText shadowColor={theme.titleShadow} style={[styles.btnText, arcadeButtonLabel(theme, 'outline')]}>{t("map.addLocationBtn")}</ShadowText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, arcadeButton(theme, 'outline')]} onPress={onCancel}>
            <ShadowText shadowColor={theme.titleShadow} style={[styles.btnText, arcadeButtonLabel(theme, 'outline')]}>{t("common.cancel")}</ShadowText>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "52%",
    alignItems: "center",
    zIndex: ZIndex.overlay,
  },
  card: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    minWidth: 160,
    alignItems: "center",
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.half,
  },
  btn: {
    width: "100%",
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  btnText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});

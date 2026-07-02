import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, BorderRadius, FontSize, ZIndex } from "@/constants/theme";
import { CenterPin } from "./CenterPin";

type Props = {
  onCancel: () => void;
  onValidate: () => void;
};

/**
 * Full-screen "pick a point on the map" overlay: a centered {@link CenterPin}
 * plus a bottom Cancel / Validate bar. Shared by the modify-location,
 * create-invader, and routing-endpoint flows (previously duplicated inline).
 */
export function MapLocationPicker({ onCancel, onValidate }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <>
      <CenterPin />
      <View style={styles.bar}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: theme.border, backgroundColor: theme.bgElement }]}
          onPress={onCancel}
        >
          <Text style={[styles.btnText, { color: theme.textMuted }]}>{t("common.cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.accent }]}
          onPress={onValidate}
        >
          <Text style={[styles.btnText, { color: theme.bg }]}>{t("common.validate")}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: Spacing.five,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: "row",
    gap: Spacing.three,
    zIndex: ZIndex.overlay,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
  btnText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
});

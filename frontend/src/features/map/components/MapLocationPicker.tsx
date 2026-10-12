import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, BorderRadius, FontSize, ZIndex } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CenterPin } from "./CenterPin";
import { CoordinateInput } from "./CoordinateInput";

/** Height of the Cancel / Validate bar — map buttons sit above it while picking. */
export const PICKER_BAR_HEIGHT = 48;

type Props = {
  onCancel: () => void;
  onValidate: () => void;
  /** Moves the map to a typed / pasted position (shows the coordinate field). */
  onGoTo?: (lat: number, lon: number) => void;
};

/**
 * Full-screen "pick a point on the map" overlay: a centered {@link CenterPin}
 * plus a bottom Cancel / Validate bar and an optional coordinate field on top. Shared by the modify-location,
 * create-invader, and routing-endpoint flows (previously duplicated inline).
 */
export function MapLocationPicker({ onCancel, onValidate, onGoTo }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <>
      <CenterPin />
      {onGoTo && (
        <View style={[styles.coords, { top: insets.top + Spacing.two }]}>
          <CoordinateInput onGoTo={onGoTo} />
        </View>
      )}
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
  coords: {
    position: "absolute",
    left: Spacing.three,
    right: Spacing.three,
    zIndex: ZIndex.overlay,
  },
  btn: {
    flex: 1,
    height: PICKER_BAR_HEIGHT,
    justifyContent: "center",
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

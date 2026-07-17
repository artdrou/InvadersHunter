import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { Spacing, BorderRadius, FontSize, ZIndex } from "@/constants/theme";
import { CenterPin } from "./CenterPin";

type Props = {
  onCreate: () => void;
  onCreatePersonal: () => void;
  onCancel: () => void;
};

/**
 * First step of the create-invader flow: a {@link CenterPin} the user drops on
 * the spot, plus a small "Create here" card offering the two things you can add
 * at that spot — a community proposal (goes to admin review) or a personal
 * invader (lands straight in your own collection).
 */
export function CreateHerePopup({ onCreate, onCreatePersonal, onCancel }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <>
      <CenterPin />
      <View style={styles.wrapper} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.text }]}>{t("map.createHere")}</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme.accent }]} onPress={onCreate}>
            <Text style={[styles.btnText, { color: theme.bg }]}>{t("map.createBtn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { borderColor: theme.accent, borderWidth: 1 }]}
            onPress={onCreatePersonal}
          >
            <Text style={[styles.btnText, { color: theme.accent }]}>{t("customInvaders.createBtn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { borderColor: theme.border, borderWidth: 1 }]} onPress={onCancel}>
            <Text style={[styles.btnText, { color: theme.textMuted }]}>{t("common.cancel")}</Text>
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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

import { useState } from "react";
import { View, Text, TextInput, Pressable, Keyboard, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/theme-context";
import { BorderRadius, FontSize, Spacing } from "@/constants/theme";
import { hapticTap } from "@/features/settings";
import { parseCoordinates } from "../coordinates";

type Props = {
  /** Called with a valid position — the picker moves its map there. */
  onGoTo: (lat: number, lon: number) => void;
};

/**
 * Text field of the location pickers: type or paste a position in any format
 * (decimal, degrees/minutes/seconds, map link…) to move the map onto it.
 */
export function CoordinateInput({ onGoTo }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit() {
    const pos = parseCoordinates(text);
    if (!pos) { setInvalid(true); return; }
    hapticTap();
    setInvalid(false);
    Keyboard.dismiss();
    onGoTo(pos.lat, pos.lon);
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.row, { backgroundColor: theme.bgElement, borderColor: invalid ? theme.danger : theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text, fontFamily: appFont, fontSize: sz(FontSize.sm) }]}
          value={text}
          onChangeText={(v) => { setText(v); setInvalid(false); }}
          onSubmitEditing={submit}
          placeholder={t("map.coordsPlaceholder")}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
        />
        {text.length > 0 && (
          <Pressable onPress={() => { setText(""); setInvalid(false); }} hitSlop={6} style={styles.iconBtn}>
            <MaterialCommunityIcons name="close" size={18} color={theme.textMuted} />
          </Pressable>
        )}
        <Pressable onPress={submit} hitSlop={6} style={[styles.goBtn, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons name="crosshairs-gps" size={18} color={theme.bg} />
        </Pressable>
      </View>
      {invalid && (
        <Text style={[styles.error, { color: theme.danger, backgroundColor: theme.bgElement, fontFamily: appFont, fontSize: sz(FontSize.xs) }]}>
          {t("map.coordsInvalid")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.one,
    minHeight: 44,
    gap: Spacing.one,
  },
  input: { flex: 1, paddingVertical: Spacing.two },
  iconBtn: { padding: Spacing.one },
  goBtn: { padding: Spacing.two, borderRadius: BorderRadius.sm },
  error: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
});

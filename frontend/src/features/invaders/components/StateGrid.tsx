import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from "@/constants/theme";
import { STATE_OPTIONS, STATE_KEYS } from "../state-options";

type Props = {
  value: string;
  /** Called with the tapped state. The parent decides toggle/clear behaviour. */
  onSelect: (state: string) => void;
};

/**
 * Condition picker used by the invader edit and create forms: the first six
 * states laid out in a 3×2 grid. Self-contained (owns its theming) so both
 * forms share one implementation.
 */
export function StateGrid({ value, onSelect }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  return (
    <View style={styles.grid}>
      {[STATE_OPTIONS.slice(0, 2), STATE_OPTIONS.slice(2, 4), STATE_OPTIONS.slice(4, 6)].map((pair, ri) => (
        <View key={ri} style={styles.row}>
          {pair.map((s) => {
            const selected = value === s;
            return (
              <Pressable
                key={s}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => onSelect(s)}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {t(STATE_KEYS[s])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    grid: { gap: 5 },
    row: { flexDirection: "row", gap: 5 },
    option: {
      flex: 1,
      paddingHorizontal: Spacing.two,
      paddingVertical: 8,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
    },
    optionSelected: {
      borderColor: t.accent,
      backgroundColor: t.bg,
    },
    optionText: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    optionTextSelected: {
      color: t.accent,
      fontFamily: font,
    },
  });
}

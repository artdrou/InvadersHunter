import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, Spacing } from "@/constants/theme";
import { ARCADE_SHADOW, arcadeButton, arcadeButtonLabel } from "@/constants/arcade-button";
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

// Same chips as the map filter window: outlined, the selected one a filled arcade button
function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    // Room for the selected chip's offset shadow
    grid: { gap: 5, paddingBottom: ARCADE_SHADOW },
    row: { flexDirection: "row", gap: 5 },
    option: {
      flex: 1,
      paddingHorizontal: Spacing.two,
      paddingVertical: 7,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: t.border,
    },
    // keep the outline's footprint so chips don't shift when toggled
    optionSelected: {
      ...arcadeButton(t),
      borderWidth: 2,
      borderColor: t.accent,
    },
    optionText: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    optionTextSelected: {
      ...arcadeButtonLabel(t),
      fontSize: sz(FontSize.sm),
    },
  });
}

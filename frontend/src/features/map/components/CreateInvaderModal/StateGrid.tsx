import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { STATE_OPTIONS, STATE_KEYS } from "@/features/invaders/state-options";
import type { CreateStyles } from "./styles";

type Props = {
  value: string;
  onSelect: (state: string) => void;
  styles: CreateStyles;
};

/** Condition picker: the first six states in a 3×2 grid; tap again to clear. */
export function StateGrid({ value, onSelect, styles }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.stateGrid}>
      {[STATE_OPTIONS.slice(0, 2), STATE_OPTIONS.slice(2, 4), STATE_OPTIONS.slice(4, 6)].map((pair, ri) => (
        <View key={ri} style={styles.stateRow}>
          {pair.map((s) => {
            const selected = value === s;
            return (
              <Pressable
                key={s}
                style={[styles.stateOption, styles.stateOptionHalf, selected && styles.stateOptionSelected]}
                onPress={() => onSelect(selected ? "" : s)}
              >
                <Text style={[styles.stateOptionText, selected && styles.stateOptionTextSelected]}>
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

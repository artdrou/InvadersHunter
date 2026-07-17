import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import type { ThemeTokens } from "@/constants/theme";
import type { CreateStyles } from "./styles";

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
  theme: ThemeTokens;
  styles: CreateStyles;
};

/**
 * Picks where the form's invader lands: the community (admin review) or the
 * user's own collection. A compact switch rather than a mode picker — the vast
 * majority of submissions are community ones, so personal is the opt-in.
 */
export function PersonalToggle({ value, onChange, theme, styles }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.personalRow, pressed && styles.btnPressed]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={t('customInvaders.toggle')}
    >
      <View style={styles.personalTextBlock}>
        <Text style={styles.personalLabel}>{t('customInvaders.toggle')}</Text>
        <Text style={styles.personalHint}>
          {value ? t('customInvaders.toggleHintOn') : t('customInvaders.toggleHintOff')}
        </Text>
      </View>
      <View style={[styles.personalTrack, value && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
        <View style={[styles.personalKnob, value ? styles.personalKnobOn : styles.personalKnobOff]} />
      </View>
    </Pressable>
  );
}

import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";

const EYE_SIZE = 20;
const EYE_HIT = 44;

/** TextInput for passwords with an eye button that toggles the text visible. */
export function PasswordInput({ style, ...props }: TextInputProps) {
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <TextInput
        {...props}
        style={[style, styles.input]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        style={styles.eye}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t(visible ? "auth.hidePassword" : "auth.showPassword")}
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={EYE_SIZE} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: "center" },
  input: { paddingRight: EYE_HIT },
  eye: {
    position: "absolute",
    right: 0,
    width: EYE_HIT,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});

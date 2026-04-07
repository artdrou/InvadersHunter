import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { BorderRadius, Spacing } from "@/constants/theme";

type Props = {
  value: string;
  onChange: (v: string) => void;
  strict: boolean;
  onToggleStrict: () => void;
  viewMode: "list" | "grid";
  onToggleView: () => void;
};

export function InvaderSearchBar({ value, onChange, strict, onToggleStrict, viewMode, onToggleView }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  return (
    <View style={[styles.row, { backgroundColor: theme.bg }]}>
      <TextInput
        style={[styles.input, { backgroundColor: theme.bgElement, color: theme.text, borderColor: theme.border, fontFamily: appFont, fontSize: sz(13) }]}
        placeholder="Search invaders…"
        placeholderTextColor={theme.textMuted}
        value={value}
        onChangeText={onChange}
        autoCapitalize="characters"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <IconToggle
        label={strict ? "A…" : "…A…"}
        active={strict}
        onPress={onToggleStrict}
        sz={sz}
      />
      <IconToggle
        label={viewMode === "list" ? "⊞" : "≡"}
        active={viewMode === "grid"}
        onPress={onToggleView}
        sz={sz}
      />
    </View>
  );
}

// ─── internal helper ─────────────────────────────────────────────────────────

function IconToggle({ label, active, onPress, sz }: { label: string; active: boolean; onPress: () => void; sz: (n: number) => number }) {
  const { theme, appFont } = useTheme();
  return (
    <Pressable
      style={[
        styles.iconBtn,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? theme.accent : "transparent",
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.iconBtnText, { color: active ? theme.bg : theme.textMuted, fontFamily: appFont, fontSize: sz(13) }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two,
    height: 38,
  },
  iconBtn: {
    height: 38,
    paddingHorizontal: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnText: {},
});

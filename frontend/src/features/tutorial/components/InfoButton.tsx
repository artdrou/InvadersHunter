import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont, ButtonFontSize } from '@/constants/theme';

type Props = {
  onPress: () => void;
  size?: number;
  color?: string;
  showLabel?: boolean;
};

export function InfoButton({ onPress, size = 22, color, showLabel = true }: Props) {
  const { theme } = useTheme();
  const fg = color ?? theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.btn,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: fg,
            backgroundColor: theme.bgElement,
          },
        ]}
      >
        <Text style={[styles.label, { color: fg, fontSize: Math.round(size * 0.52) }]}>i</Text>
      </View>
      {showLabel && <Text style={[styles.helpText, { color: fg }]}>help</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  btn: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: ButtonFont,
    lineHeight: undefined,
    includeFontPadding: false,
  },
  helpText: {
    fontFamily: ButtonFont,
    fontSize: ButtonFontSize.xs,
    letterSpacing: 0.5,
  },
  pressed: { opacity: 0.5 },
});

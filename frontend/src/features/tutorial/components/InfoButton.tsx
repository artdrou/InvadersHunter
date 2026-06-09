import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont } from '@/constants/theme';

type Props = {
  onPress: () => void;
  size?: number;
  color?: string;
};

export function InfoButton({ onPress, size = 22, color }: Props) {
  const { theme } = useTheme();
  const fg = color ?? theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: fg,
          backgroundColor: theme.bgElement,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: fg, fontSize: Math.round(size * 0.52) }]}>i</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.5 },
});

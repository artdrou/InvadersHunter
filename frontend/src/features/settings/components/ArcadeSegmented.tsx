/**
 * Arcade segmented control for settings rows: square chips side by side, the active one
 * filled like the Flash button (FR | EN, ON | OFF).
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFontBold, FontSize } from '@/constants/theme';
import { arcadeLabelColor } from '@/constants/arcade-button';

type Option<T> = { value: T; label: string };

type Props<T> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

const RADIUS = 4;
const BOLD_ADVANCE = 0.5625;  // FreePixel Bold glyph width, in em
const CHIP_WIDTH = Math.ceil(3 * FontSize.xs * BOLD_ADVANCE) + 2 * 7 + 2 * 2;

export function ArcadeSegmented<T>({ options, value, onChange, disabled }: Props<T>) {
  const { theme } = useTheme();
  return (
    <View style={[styles.group, disabled && styles.disabled]}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        const first = i === 0;
        const last = i === options.length - 1;
        return (
          <Pressable
            key={String(opt.value)}
            disabled={disabled || active}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accent : 'transparent' },
              first && { borderTopLeftRadius: RADIUS, borderBottomLeftRadius: RADIUS },
              last && { borderTopRightRadius: RADIUS, borderBottomRightRadius: RADIUS },
              !first && styles.notFirst,
              active && styles.onTop,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, { color: active ? arcadeLabelColor(theme) : theme.textMuted }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row' },
  // Same chip width everywhere (FR | EN lines up with ON | OFF): room for 3 bold characters
  chip: { borderWidth: 2, paddingHorizontal: 7, paddingVertical: 3, minWidth: CHIP_WIDTH, alignItems: 'center' },
  notFirst: { marginLeft: -2 },   // neighbours share one border
  onTop: { zIndex: 1 },
  label: { fontFamily: ButtonFontBold, fontSize: FontSize.xs },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
});

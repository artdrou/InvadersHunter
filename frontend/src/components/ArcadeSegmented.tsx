/**
 * Arcade segmented control for settings rows: square chips side by side, the active one
 * filled like the Flash button (FR | EN, ON | OFF). `stretch`: full-width tabs
 * sharing the row equally (e.g. Formes | Couleurs), framed in the accent color with
 * the theme's arcade shadow like the buttons.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFontBold, FontSize } from '@/constants/theme';
import { arcadeLabelColor, arcadeShadow } from '@/constants/arcade-button';

type Option<T> = { value: T; label: string };

type Props<T> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  stretch?: boolean;
};

const RADIUS = 4;
const BOLD_ADVANCE = 0.5625;  // FreePixel Bold glyph width, in em
const CHIP_WIDTH = Math.ceil(3 * FontSize.xs * BOLD_ADVANCE) + 2 * 7 + 2 * 2;

export function ArcadeSegmented<T>({ options, value, onChange, disabled, stretch }: Props<T>) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.group,
        stretch && [styles.groupStretch, { backgroundColor: theme.bgElement, boxShadow: arcadeShadow(theme) }],
        disabled && styles.disabled,
      ]}
    >
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
              stretch && styles.chipStretch,
              { borderColor: active || stretch ? theme.accent : theme.border, backgroundColor: active ? theme.accent : 'transparent' },
              first && { borderTopLeftRadius: RADIUS, borderBottomLeftRadius: RADIUS },
              last && { borderTopRightRadius: RADIUS, borderBottomRightRadius: RADIUS },
              !first && styles.notFirst,
              active && styles.onTop,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, stretch && styles.labelStretch, { color: active ? arcadeLabelColor(theme) : theme.textMuted }]}>
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
  // Rounded like the chips so the shadow follows the bar; room on the right / bottom for it
  groupStretch: { borderRadius: RADIUS, marginRight: 4, marginBottom: 4 },
  // Same chip width everywhere (FR | EN lines up with ON | OFF): room for 3 bold characters
  chip: { borderWidth: 2, paddingHorizontal: 7, paddingVertical: 3, minWidth: CHIP_WIDTH, alignItems: 'center' },
  chipStretch: { flex: 1, paddingVertical: 8 },
  notFirst: { marginLeft: -2 },   // neighbours share one border
  onTop: { zIndex: 1 },
  label: { fontFamily: ButtonFontBold, fontSize: FontSize.xs },
  labelStretch: { fontSize: FontSize.md },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
});

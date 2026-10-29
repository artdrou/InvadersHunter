/**
 * − / + button of the settings steppers (cluster zoom, marker opacity / bloom, avatar
 * halo): an arcade outline button; at the end of its range, flat and muted with no
 * shadow (the disabled look of the routing Compute button).
 */
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFontBold, BorderRadius, FontSize } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel } from '@/constants/arcade-button';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { ShadowText } from '@/components/ShadowText';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** 'lg': bigger square and glyph (row stepper of Appearance). */
  size?: 'md' | 'lg';
};

export function StepButton({ label, onPress, disabled, size = 'md' }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const lg = size === 'lg';
  const text = [styles.text, lg && styles.textLg];
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, lg && styles.btnLg, disabled ? styles.off : styles.on, pressed && styles.pressed]}
      disabled={disabled}
      onPress={onPress}
    >
      {disabled
        ? <Text style={[text, styles.textOff]}>{label}</Text>
        : <ShadowText shadowColor={theme.titleShadow} style={text}>{label}</ShadowText>}
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm },
    btnLg: { width: 36, height: 36 },
    on: arcadeButton(t, 'outline'),
    off: { borderWidth: 2, borderColor: t.border, backgroundColor: t.bgElement },
    text: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.lg, lineHeight: 22 },
    textLg: { fontSize: FontSize.xl, lineHeight: 24 },
    textOff: { color: t.textMuted, fontFamily: ButtonFontBold },
    pressed: { opacity: 0.6 },
  });
}

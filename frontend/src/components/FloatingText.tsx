/**
 * Floating confirmation text ("Code copied!", "Update sent"): pops up, drifts slowly
 * upward and fades out, arcade style (bold pixel font, accent, sharp shadow).
 * Absolutely positioned by the caller (`style`), so it never moves the layout.
 *
 *   const floating = useFloatingText();
 *   floating.show();
 *   <FloatingText progress={floating.progress} text="…" style={{ bottom: 40 }} />
 */
import { useRef } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFontBold, FontSize, Motion } from '@/constants/theme';
import { ShadowText } from './ShadowText';

const RISE_PX = 36;

/** Drives one FloatingText: `show()` replays the float from the start. */
export function useFloatingText(durationMs: number = Motion.floatText) {
  const progress = useRef(new Animated.Value(0)).current;
  const show = () => {
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };
  return { progress, show };
}

type Props = {
  progress: Animated.Value;
  text: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function FloatingText({ progress, text, size = FontSize.sm, style }: Props) {
  const { theme } = useTheme();
  // Hidden at rest (0) and at the end (1); fully visible for the first half of the rise
  const opacity = progress.interpolate({ inputRange: [0, 0.01, 0.5, 1], outputRange: [0, 1, 1, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -RISE_PX] });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style, { opacity, transform: [{ translateY }] }]}>
      <ShadowText
        shadowColor={theme.titleShadow}
        style={{ fontFamily: ButtonFontBold, fontSize: size, color: theme.accent }}
        numberOfLines={1}
      >
        {text}
      </ShadowText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center' },
});

/**
 * Screen title in the arcade style: three stacked copies of the text
 *   1. Pixelmania Solid, offset   → shadow   (theme.titleShadow)
 *   2. Pixelmania Solid           → inside   (theme.titleInner)
 *   3. Pixelmania (outline only)  → outline  (theme.titleStroke)
 * "initial" style (theme.titleStyle) draws the first letter bigger, like the logo.
 *
 * Pixelmania has no lowercase, accents nor most punctuation: the text is upper-cased,
 * stripped of its accents, `_ - /` become spaces and other symbols are dropped (so keep
 * exact codes like invader names out of arcade titles). Pixelmania Solid (design/logo/solid_font.py) has the same metrics, so the
 * layers line up exactly, wrapping included (they share the same width).
 */
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { TitleFont, TitleSolidFont, type ThemeTokens } from '@/constants/theme';

type TitleColors = Pick<ThemeTokens, 'titleStroke' | 'titleInner' | 'titleShadow' | 'titleStyle'>;

type Props = {
  text: string;
  size?: number;
  /** Colours to use instead of the active theme's (theme previews). */
  colors?: TitleColors;
  style?: StyleProp<ViewStyle>;
};

const INITIAL_SCALE = 1.35;

export function ArcadeTitle({ text, size = 22, colors, style }: Props) {
  const { theme } = useTheme();
  const c = colors ?? theme;
  const clean = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[_\-/]/g, ' ')                 // separators the font lacks → space
    .replace(/[^A-Z0-9 .,']/g, '');           // anything else it lacks is dropped
  const shadow = Math.max(2, Math.round(size / 12));

  const line = (fontFamily: string, color: string) => (
    <Text style={{ fontFamily, color, fontSize: size }}>
      {c.titleStyle === 'initial'
        ? <><Text style={{ fontSize: Math.round(size * INITIAL_SCALE) }}>{clean.charAt(0)}</Text>{clean.slice(1)}</>
        : clean}
    </Text>
  );

  return (
    <View style={[styles.wrap, { paddingRight: shadow, paddingBottom: shadow }, style]} accessibilityRole="header">
      <View style={[styles.layer, { top: shadow, left: shadow, right: 0, bottom: 0 }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {line(TitleSolidFont, c.titleShadow)}
      </View>
      <View style={[styles.layer, { top: 0, left: 0, right: shadow, bottom: shadow }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {line(TitleSolidFont, c.titleInner)}
      </View>
      {line(TitleFont, c.titleStroke)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  // Each layer is exactly as wide as the outline text (the wrap's padding is the shadow
  // room), so long titles wrap the same way in all three
  layer: { position: 'absolute' },
});

/**
 * Screen title in the arcade style: three stacked copies of the text
 *   1. Pixelmania Solid, offset   → shadow   (theme.titleShadow)
 *   2. Pixelmania Solid           → inside   (theme.titleInner)
 *   3. Pixelmania (outline only)  → outline  (theme.titleStroke)
 * "initial" style (theme.titleStyle) draws the first letter bigger, like the logo.
 *
 * Pixelmania has no lowercase and little punctuation: the text is upper-cased, accents
 * the font lacks are stripped, `- /` become spaces and other symbols are dropped.
 * design/logo/pixelmania_glyphs.py added `_` (invader codes), a narrower zero and the
 * French accented capitals (É È Ê Ë À Â Ä Î Ï Ô Ö Ù Û Ü Ç). The accents made the font's
 * line box taller: the title is pulled up / in by the same amount, so screens don't move.
 * Pixelmania Solid (design/logo/solid_font.py) has the same metrics, so the
 * layers line up exactly, wrapping included (they share the same width).
 */
import { View, Text, StyleSheet, PixelRatio, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { TitleFont, TitleSolidFont, type ThemeTokens } from '@/constants/theme';
import { PIXELMANIA_ADVANCE, PIXELMANIA_EXTRA, PIXELMANIA_UNITS_PER_EM } from '@/constants/pixelmania-metrics';

type TitleColors = Pick<ThemeTokens, 'titleStroke' | 'titleInner' | 'titleShadow' | 'titleStyle'>;

type Props = {
  text: string;
  size?: number;
  /** Colours to use instead of the active theme's (theme previews). */
  colors?: TitleColors;
  style?: StyleProp<ViewStyle>;
  /** Room available (px): the size shrinks so the title stays on one line instead of wrapping. */
  fitWidth?: number;
};

const INITIAL_SCALE = 1.35;
const FIT_MARGIN = 0.97;      // rounding / renderer slack
const EXTRA = Platform.OS === 'android' ? PIXELMANIA_EXTRA.android : PIXELMANIA_EXTRA.ios;

/** Text as Pixelmania can draw it (see the header comment). */
function arcadeText(text: string): string {
  return Array.from(text.normalize('NFC').toUpperCase(), (ch) => {
    if (PIXELMANIA_ADVANCE[ch] != null) return ch;
    const bare = ch.normalize('NFD').charAt(0);           // accent the font lacks → bare letter
    if (bare !== ch && PIXELMANIA_ADVANCE[bare] != null) return bare;
    return ch === '-' || ch === '/' ? ' ' : '';
  }).join('');
}

/** Width of `clean` at font size 1, from the glyph advances (the font has no kerning). */
function widthAtSize1(clean: string, bigInitial: boolean): number {
  let units = 0;
  for (let i = 0; i < clean.length; i++) {
    const adv = PIXELMANIA_ADVANCE[clean[i]] ?? PIXELMANIA_ADVANCE[' '];
    units += i === 0 && bigInitial ? adv * INITIAL_SCALE : adv;
  }
  return (units / PIXELMANIA_UNITS_PER_EM) * PixelRatio.getFontScale();
}

export function ArcadeTitle({ text, size: maxSize = 22, colors, style, fitWidth }: Props) {
  const { theme } = useTheme();
  const c = colors ?? theme;
  const clean = arcadeText(text);
  const bigInitial = c.titleStyle === 'initial';
  const size = fitWidth
    ? Math.max(8, Math.min(maxSize, Math.floor(((fitWidth - Math.max(2, Math.round(maxSize / 12))) * FIT_MARGIN) / widthAtSize1(clean, bigInitial))))
    : maxSize;
  const shadow = Math.max(2, Math.round(size / 12));
  // Line box growth from the accents, at the size that sets the line height
  const unit = ((bigInitial ? Math.round(size * INITIAL_SCALE) : size) / PIXELMANIA_UNITS_PER_EM) * PixelRatio.getFontScale();
  const pull = { marginTop: -EXTRA.top * unit, marginBottom: -EXTRA.bottom * unit };

  const line = (fontFamily: string, color: string) => (
    <Text style={{ fontFamily, color, fontSize: size }} numberOfLines={fitWidth ? 1 : undefined}>
      {bigInitial
        ? <><Text style={{ fontSize: Math.round(size * INITIAL_SCALE) }}>{clean.charAt(0)}</Text>{clean.slice(1)}</>
        : clean}
    </Text>
  );

  return (
    <View style={[styles.wrap, style]} accessibilityRole="header">
      <View style={[{ paddingRight: shadow, paddingBottom: shadow }, pull]}>
        <View style={[styles.layer, { top: shadow, left: shadow, right: 0, bottom: 0 }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {line(TitleSolidFont, c.titleShadow)}
        </View>
        <View style={[styles.layer, { top: 0, left: 0, right: shadow, bottom: shadow }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {line(TitleSolidFont, c.titleInner)}
        </View>
        {line(TitleFont, c.titleStroke)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  // Each layer is exactly as wide as the outline text (the wrap's padding is the shadow
  // room), so long titles wrap the same way in all three
  layer: { position: 'absolute' },
});

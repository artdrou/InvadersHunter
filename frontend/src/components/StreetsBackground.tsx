/**
 * The street grid of the HintVaders artwork (icon, splash, emails), fading out towards
 * the bottom (baked into the image). Absolutely positioned: render it as the first
 * child of a full-screen container, the content comes after it.
 *
 *  - "full":  the signed-out screens, behind the logo
 *  - "faint": in-app screens (settings…), a light texture that never competes with text
 *
 * Artwork: design/logo/wordmark.py (login-streets.png).
 */
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/contexts/theme-context';

const STREETS = require('../../assets/images/login-streets.png');
const { width: W, height: H } = Image.resolveAssetSource(STREETS);

// Opacity per intensity, on dark / light themes (the grid is drawn for dark backgrounds)
const OPACITY = {
  full: { dark: 1, light: 0.5 },
  faint: { dark: 0.35, light: 0.18 },
} as const;

export function StreetsBackground({ intensity = 'full' }: { intensity?: keyof typeof OPACITY }) {
  const { theme } = useTheme();
  const window = useWindowDimensions();
  const opacity = OPACITY[intensity][theme.isLight ? 'light' : 'dark'];
  // Pixel sizes: a percentage width resolves against the parent's padded box.
  return (
    <Image
      source={STREETS}
      style={[styles.streets, { width: window.width, height: (window.width * H) / W, opacity }]}
      resizeMode="stretch"
    />
  );
}

const styles = StyleSheet.create({
  streets: { position: 'absolute', top: 0, left: 0 },
});

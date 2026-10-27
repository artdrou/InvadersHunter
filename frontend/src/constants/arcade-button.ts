/**
 * Arcade button look, shared by every action button in the app:
 *   filled   accent background, label in the shadow colour (light text on light themes,
 *            whose accent is dark)
 *   outline  2px accent border, accent label (render it with <ShadowText> for the label shadow)
 *   danger   2px red border, red label, dark red shadow (destructive actions: always an
 *            outline, never filled)
 * Offset shadow in the theme's title shadow colour (dark red for danger), FreePixel Bold.
 * Keep each button's own size / padding / radius; spread these on top.
 */
import type { TextStyle, ViewStyle } from 'react-native';
import { type ThemeTokens, ButtonFontBold } from './theme';

export type ArcadeButtonKind = 'filled' | 'outline' | 'danger';

export const ARCADE_SHADOW = 3;

export function arcadeShadow(t: ThemeTokens, offset = ARCADE_SHADOW): string {
  return `${offset}px ${offset}px 0px ${t.titleShadow}`;
}

/** `#rrggbb` at `factor` brightness (other formats are returned as they are). */
function darken(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * factor).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Shadow for a red (destructive) button: its red, darkened — the shadow pink is often that same red. */
export function arcadeDangerShadow(red: string): string {
  return `${ARCADE_SHADOW}px ${ARCADE_SHADOW}px 0px ${darken(red, 0.45)}`;
}

export function arcadeButton(t: ThemeTokens, kind: ArcadeButtonKind = 'filled'): ViewStyle {
  if (kind === 'filled') return { backgroundColor: t.accent, borderWidth: 0, boxShadow: arcadeShadow(t) };
  if (kind === 'danger') {
    return { borderWidth: 2, borderColor: t.danger, backgroundColor: 'transparent', boxShadow: arcadeDangerShadow(t.danger) };
  }
  return { borderWidth: 2, borderColor: t.accent, backgroundColor: 'transparent', boxShadow: arcadeShadow(t) };
}

export function arcadeLabelColor(t: ThemeTokens, kind: ArcadeButtonKind = 'filled'): string {
  if (kind === 'filled') return t.isLight ? t.bg : t.titleShadow;
  return kind === 'danger' ? t.danger : t.accent;
}

export function arcadeButtonLabel(t: ThemeTokens, kind: ArcadeButtonKind = 'filled'): TextStyle {
  return { fontFamily: ButtonFontBold, color: arcadeLabelColor(t, kind) };
}

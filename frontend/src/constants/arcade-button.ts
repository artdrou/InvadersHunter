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
import { type ThemeTokens, ButtonFontBold, FontSize } from './theme';

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

/** Shadow colour for red (destructive) things: their red, darkened — the shadow pink is often that same red. */
export function dangerShadowColor(red: string): string {
  return darken(red, 0.45);
}

export function arcadeDangerShadow(red: string): string {
  return `${ARCADE_SHADOW}px ${ARCADE_SHADOW}px 0px ${dangerShadowColor(red)}`;
}

/** Flashed state colours: the theme's own, else its title inside (fill) and outline (ink). */
export function flashedColors(t: ThemeTokens): { fill: string; ink: string } {
  return { fill: t.flashedFill ?? t.titleInner, ink: t.flashedInk ?? t.titleStroke };
}

/** The flashed state block (where the Flash button was): title-coloured, outlined, shadowed. */
export function arcadeFlashed(t: ThemeTokens): ViewStyle {
  const { fill, ink } = flashedColors(t);
  return { backgroundColor: fill, borderWidth: 2, borderColor: ink, boxShadow: arcadeShadow(t) };
}

// ─── Cards, section labels, row dividers (settings-style screens) ────────────

/** Info / list card: thick border, small radius, hard shadow (dark on dark themes, border colour on light). */
export function arcadeCard(t: ThemeTokens): ViewStyle {
  return {
    backgroundColor: t.bgElement,
    borderWidth: 2,
    borderColor: t.border,
    borderRadius: 6,
    boxShadow: `${ARCADE_SHADOW}px ${ARCADE_SHADOW}px 0px ${t.isLight ? t.border : 'rgba(0, 0, 0, 0.6)'}`,
  };
}

/** Section label above a card: accent, bold, spaced capitals (components/ArcadeSectionLabel adds the dotted rule). */
export function arcadeSectionLabel(t: ThemeTokens): TextStyle {
  return { color: t.accent, fontFamily: ButtonFontBold, fontSize: FontSize.xs, letterSpacing: 1, textTransform: 'uppercase' };
}

/** Divider between the rows of a card: dotted, on top of each row after the first. */
export function arcadeRowDivider(t: ThemeTokens): ViewStyle {
  return { borderTopWidth: 2, borderTopColor: t.bgDivider, borderStyle: 'dotted' };
}

export function arcadeButton(t: ThemeTokens, kind: ArcadeButtonKind = 'filled'): ViewStyle {
  if (kind === 'filled') return { backgroundColor: t.accent, borderWidth: 0, boxShadow: arcadeShadow(t) };
  if (kind === 'danger') {
    return { borderWidth: 2, borderColor: t.danger, backgroundColor: 'transparent', boxShadow: arcadeDangerShadow(t.danger) };
  }
  return { borderWidth: 2, borderColor: t.accent, backgroundColor: 'transparent', boxShadow: arcadeShadow(t) };
}

/**
 * Pixel-art icon buttons (components/ui/PixelButton + components/ShadowIcon): idle = border
 * outline, muted icon; active = accent outline and icon, both with the hard shadow (never filled).
 * The idle icon keeps a transparent shadow so it doesn't move when the state changes.
 */
export function arcadePixelButton(t: ThemeTokens, active: boolean): {
  button: { fill: string; stroke: string; shadow?: string };
  icon: string;
  iconShadow: string;
} {
  if (active) return { button: { fill: t.bgElement, stroke: t.accent, shadow: t.titleShadow }, icon: t.accent, iconShadow: t.titleShadow };
  return { button: { fill: t.bgElement, stroke: t.border }, icon: t.textMuted, iconShadow: 'transparent' };
}

export function arcadeLabelColor(t: ThemeTokens, kind: ArcadeButtonKind = 'filled'): string {
  if (kind === 'filled') return t.isLight ? t.bg : t.titleShadow;
  return kind === 'danger' ? t.danger : t.accent;
}

export function arcadeButtonLabel(t: ThemeTokens, kind: ArcadeButtonKind = 'filled'): TextStyle {
  return { fontFamily: ButtonFontBold, color: arcadeLabelColor(t, kind) };
}

import '@/global.css';

import { Platform } from 'react-native';

// ─── Legacy Colors (used by existing components via hooks/use-theme) ──────────

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ─── Brand ────────────────────────────────────────────────────────────────────
// Fixed brand colors that never change between themes.

export const Brand = {
  yellow: '#ffd000',
  pink: '#ff0062',
  cyan: '#1cffb7',
  capturedGlow: 'rgba(0, 96, 240, 0.9)',
  uncapturedGlow: 'rgba(171, 5, 19, 0.9)',
  capturedOutline: '#00b7e0',
  uncapturedOutline: '#79032e',
} as const;

// ─── Theme tokens ─────────────────────────────────────────────────────────────
// Semantic names that every theme must fill in.

export type ThemeTokens = {
  // Backgrounds
  bg: string;
  bgElement: string;
  bgDivider: string;
  bgInputValid: string;
  bgInputInvalid: string;

  // Text
  text: string;
  textMuted: string;

  // Borders
  border: string;
  borderInputValid: string;
  borderInputInvalid: string;

  // Semantic role colors (can be overridden per theme)
  accent: string;      // primary action color
  danger: string;      // error / destructive
  success: string;     // captured / success state
  locationDot: string; // GPS position marker & cone
  routePath: string;   // navigation route line color
};

// ─── Built-in themes ──────────────────────────────────────────────────────────

// Dark theme — deep navy blue (formerly the "blue" theme; now the default dark).
export const darkTheme: ThemeTokens = {
  bg: '#0a0f1e',
  bgElement: '#111827',
  bgDivider: '#1e2a3a',
  bgInputValid: '#0a2a1a',
  bgInputInvalid: '#2a0a0a',

  text: '#e8f0fe',
  textMuted: '#5b7a9d',

  border: '#1e3a5f',
  borderInputValid: Brand.cyan,
  borderInputInvalid: Brand.pink,

  accent: Brand.cyan,
  danger: Brand.pink,
  success: Brand.cyan,
  locationDot: Brand.cyan,
  routePath: '#3effa0',
};

export const lightTheme: ThemeTokens = {
  bg: '#f2f2f2',
  bgElement: '#ffffff',
  bgDivider: '#e0e0e0',
  bgInputValid: '#e6fff5',
  bgInputInvalid: '#fff0f3',

  text: '#000000',
  textMuted: '#888888',

  border: '#cccccc',
  borderInputValid: Brand.cyan,
  borderInputInvalid: Brand.pink,

  accent: '#002FA7',
  danger: Brand.pink,
  success: Brand.cyan,
  locationDot: '#4a90e2',
  routePath: '#00aa66',
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const;

export const themeLabels: Record<ThemeName, string> = {
  dark: 'Dark',
  light: 'Light',
};

export type ThemeName = keyof typeof themes;

// ─── Scale tokens ─────────────────────────────────────────────────────────────

export const FontSize = {
  xxs: 11,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

/**
 * Sizes for ButtonFont (pixel font). These render larger nominal-pt values
 * because pixel fonts have smaller x-height than system fonts; the tiers
 * below are calibrated for visual parity with the rest of the UI.
 *
 * Tier guide:
 *  - xxs   9  tiny pixel-badge numbers (counts on routing badges)
 *  - xs   13  tiny badges (confidence indicators)
 *  - sm   18  small status badges
 *  - md   21  section labels, inline edit hints
 *  - lg   24  filter chips, filter options, small secondaries
 *  - xl   27  cancel / theme picker / modal secondaries
 *  - xxl  30  primary CTAs (login, sync, approve, etc.)
 */
export const ButtonFontSize = {
  xxs: 9,
  xs: 13,
  sm: 18,
  md: 21,
  lg: 24,
  xl: 27,
  xxl: 30,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 14,
  pill: 20,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// ─── Elevation & motion ───────────────────────────────────────────────────────
// Stacking order for absolutely-positioned overlays. Higher = closer to the user.

export const ZIndex = {
  map: 5,        // map-level FABs (routing button)
  control: 10,   // on-map controls (locate, compass, filter bar, popup, news)
  picker: 15,    // location-picker pin (sits above controls, below its action bar)
  overlay: 20,   // full-screen bars, banners, toasts
} as const;

/** Animation durations (ms), kept consistent across sheets/toasts. */
export const Motion = {
  sheetIn: 220,   // bottom-sheet / sub-sheet slide-in
  sheetOut: 260,  // bottom-sheet slide-out
  toastHold: 2000,// how long a toast stays fully visible before fading
  toastFade: 600, // toast fade-out
  reassert: 500,  // delay before re-asserting a camera move after a transition
} as const;

// ─── Overlay scrims & fixed colors ────────────────────────────────────────────
// Theme-independent: scrims darken whatever is behind them in every theme.

export const Overlay = {
  scrimSoft: 'rgba(0,0,0,0.25)',  // sheet backdrop
  scrim: 'rgba(0,0,0,0.65)',      // offline banner
  scrimStrong: 'rgba(0,0,0,0.75)',// toast
} as const;

/** Pure white — text/icons sitting on a colored (accent/brand) surface. */
export const White = '#ffffff';

// ─── App fonts ────────────────────────────────────────────────────────────────

/** Main text font (labels, values, titles). */
export const AppFont = 'FreePixel';
export const AppFontScale = 0.9;

/** Font for interactive controls (buttons, pills, selectors). */
export const ButtonFont = 'FreePixel';

/** Used exclusively for the app title on the login screen. */
export const TitleFont = 'Pixelmania';

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

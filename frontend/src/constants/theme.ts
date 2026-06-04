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
};

// ─── Built-in themes ──────────────────────────────────────────────────────────

export const darkTheme: ThemeTokens = {
  bg: '#000000',
  bgElement: '#111111',
  bgDivider: '#222222',
  bgInputValid: '#0a2a1a',
  bgInputInvalid: '#2a0a0a',

  text: '#ffffff',
  textMuted: '#666666',

  border: '#333333',
  borderInputValid: Brand.cyan,
  borderInputInvalid: Brand.pink,

  accent: Brand.yellow,
  danger: Brand.pink,
  success: Brand.cyan,
  locationDot: Brand.yellow,
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
};

export const blueTheme: ThemeTokens = {
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
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
  blue: blueTheme,
} as const;

export const themeLabels: Record<ThemeName, string> = {
  dark: 'Dark',
  light: 'Light',
  blue: 'Blue',
};

export type ThemeName = keyof typeof themes;

// ─── Scale tokens ─────────────────────────────────────────────────────────────

export const FontSize = {
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
 *  - xs   13  tiny badges (confidence indicators)
 *  - sm   18  small status badges
 *  - md   21  section labels, inline edit hints
 *  - lg   24  filter chips, filter options, small secondaries
 *  - xl   27  cancel / theme picker / modal secondaries
 *  - xxl  30  primary CTAs (login, sync, approve, etc.)
 */
export const ButtonFontSize = {
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

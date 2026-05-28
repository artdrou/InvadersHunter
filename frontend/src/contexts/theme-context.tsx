import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type ThemeName, type ThemeTokens, AppFont, AppFontScale } from '@/constants/theme';

const THEME_KEY = 'app-theme';
const ACCENT_KEY = 'app-accent-override';
const FALLBACK_THEME: ThemeName = 'blue';

// ─── Context ──────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  /** Effective theme tokens — includes any active accent override. */
  theme: ThemeTokens;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  /** User-picked accent override (null = use the theme's default). */
  accentOverride: string | null;
  setAccentOverride: (color: string | null) => void;
  /** Default accent for the current theme (ignores override). Useful as a reset target. */
  defaultAccent: string;
  appFont: string;
  fontScale: number;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(FALLBACK_THEME);
  const [accentOverride, setAccentOverrideState] = useState<string | null>(null);

  // Hydrate from AsyncStorage on mount (async — RN doesn't have localStorage).
  useEffect(() => {
    (async () => {
      try {
        const [storedTheme, storedAccent] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(ACCENT_KEY),
        ]);
        if (storedTheme && storedTheme in themes) {
          setThemeNameState(storedTheme as ThemeName);
        }
        if (storedAccent) setAccentOverrideState(storedAccent);
      } catch {}
    })();
  }, []);

  function setTheme(name: ThemeName) {
    setThemeNameState(name);
    AsyncStorage.setItem(THEME_KEY, name).catch(() => {});
  }

  function setAccentOverride(color: string | null) {
    setAccentOverrideState(color);
    if (color) AsyncStorage.setItem(ACCENT_KEY, color).catch(() => {});
    else AsyncStorage.removeItem(ACCENT_KEY).catch(() => {});
  }

  const baseTheme = themes[themeName];
  const theme: ThemeTokens = accentOverride
    ? { ...baseTheme, accent: accentOverride, locationDot: accentOverride }
    : baseTheme;

  return (
    <ThemeContext.Provider value={{
      theme,
      themeName,
      setTheme,
      accentOverride,
      setAccentOverride,
      defaultAccent: baseTheme.accent,
      appFont: AppFont,
      fontScale: AppFontScale,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

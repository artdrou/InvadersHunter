import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  themes, buildCustomTheme, DEFAULT_CUSTOM_THEME,
  type ThemeName, type ThemeTokens, type CustomThemeSettings, AppFont, AppFontScale,
} from '@/constants/theme';

const THEME_KEY        = 'app-theme';
const CUSTOM_KEY       = 'app-custom-theme';
// Before the custom theme, accent / route colours were overrides on any theme.
const LEGACY_ACCENT    = 'app-accent-override';
const LEGACY_ROUTE     = 'app-route-path-override';
const FALLBACK_THEME: ThemeName = 'dark';

// ─── Context ──────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  /** Effective theme tokens (the custom theme is built from `custom`). */
  theme: ThemeTokens;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  /** Settings of the custom theme (kept even while a built-in theme is active). */
  custom: CustomThemeSettings;
  setCustom: (patch: Partial<CustomThemeSettings>) => void;
  appFont: string;
  fontScale: number;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemeName = (v: string | null): v is ThemeName => !!v && (v === 'custom' || v in themes);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(FALLBACK_THEME);
  const [custom, setCustomState] = useState<CustomThemeSettings>(DEFAULT_CUSTOM_THEME);

  // Hydrate from AsyncStorage on mount.
  useEffect(() => {
    (async () => {
      try {
        const [storedTheme, storedCustom, legacyAccent, legacyRoute] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(CUSTOM_KEY),
          AsyncStorage.getItem(LEGACY_ACCENT),
          AsyncStorage.getItem(LEGACY_ROUTE),
        ]);
        if (isThemeName(storedTheme)) setThemeNameState(storedTheme);
        if (storedCustom) {
          setCustomState({ ...DEFAULT_CUSTOM_THEME, ...JSON.parse(storedCustom) });
        } else if (legacyAccent || legacyRoute) {
          // Keep the colours the user picked: they seed the custom theme.
          const base = isThemeName(storedTheme) && storedTheme !== 'custom' && themes[storedTheme].isLight
            ? 'light' : 'dark';
          const seeded = {
            ...DEFAULT_CUSTOM_THEME,
            base,
            ...(legacyAccent && { accent: legacyAccent }),
            ...(legacyRoute && { routePath: legacyRoute }),
          } as CustomThemeSettings;
          setCustomState(seeded);
          AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(seeded)).catch(() => {});
        }
        if (legacyAccent || legacyRoute) AsyncStorage.multiRemove([LEGACY_ACCENT, LEGACY_ROUTE]).catch(() => {});
      } catch {}
    })();
  }, []);

  function setTheme(name: ThemeName) {
    setThemeNameState(name);
    AsyncStorage.setItem(THEME_KEY, name).catch(() => {});
  }

  function setCustom(patch: Partial<CustomThemeSettings>) {
    setCustomState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  const theme: ThemeTokens = themeName === 'custom' ? buildCustomTheme(custom) : themes[themeName];

  return (
    <ThemeContext.Provider value={{
      theme,
      themeName,
      setTheme,
      custom,
      setCustom,
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

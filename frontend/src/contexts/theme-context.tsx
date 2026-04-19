import { createContext, useContext, useState, type ReactNode } from 'react';
import { themes, type ThemeName, type ThemeTokens, AppFont, AppFontScale } from '@/constants/theme';

const THEME_KEY = 'app-theme';

function loadTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored && stored in themes) return stored as ThemeName;
  } catch {}
  return 'blue';
}

function saveTheme(name: ThemeName) {
  try { localStorage.setItem(THEME_KEY, name); } catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  theme: ThemeTokens;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  appFont: string;
  fontScale: number;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(loadTheme);

  function setTheme(name: ThemeName) {
    saveTheme(name);
    setThemeName(name);
  }

  const theme = themes[themeName];

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme, appFont: AppFont, fontScale: AppFontScale }}>
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

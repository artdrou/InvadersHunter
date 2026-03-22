import { createContext, useContext, useState, type ReactNode } from 'react';
import { themes, type ThemeName, type ThemeTokens } from '@/constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'app-theme';

function loadTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in themes) return stored as ThemeName;
  } catch {
    // localStorage not available (native)
  }
  return 'dark';
}

function saveTheme(name: ThemeName) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // localStorage not available (native)
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  theme: ThemeTokens;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
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
    <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
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

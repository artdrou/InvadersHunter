import { useMemo } from 'react';
import { useTheme } from '@/contexts/theme-context';
import type { ThemeTokens } from '@/constants/theme';

/**
 * Memoize a themed StyleSheet. Pass a `makeStyles(theme)` factory and get back a
 * stylesheet that only rebuilds when the theme changes — replacing the repeated
 * `const styles = makeStyles(theme)`, which rebuilt the sheet on every render.
 */
export function useThemedStyles<T>(factory: (theme: ThemeTokens) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}

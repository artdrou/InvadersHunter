import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { darkTheme, White, Spacing, BorderRadius, FontSize, AppFont } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel } from '@/constants/arcade-button';
import { logger } from '@/services/logger';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Top-level crash guard. Catches render/lifecycle errors anywhere below it,
 * reports them via {@link logger}, and shows a recoverable fallback instead of
 * a white screen. Sits above ThemeProvider, so the fallback uses the static
 * dark theme rather than the theme context (which may itself have failed).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logger.error('[ErrorBoundary] uncaught render error', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>The app hit an unexpected error. You can try again.</Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    color: White,
    fontFamily: AppFont,
    fontSize: FontSize.xl,
    textAlign: 'center',
  },
  message: {
    color: darkTheme.textMuted,
    fontFamily: AppFont,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  // Arcade filled button in the static dark theme
  button: {
    marginTop: Spacing.three,
    ...arcadeButton(darkTheme),
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
  },
  buttonText: {
    ...arcadeButtonLabel(darkTheme),
    fontSize: FontSize.md,
  },
  pressed: { opacity: 0.7 },
});

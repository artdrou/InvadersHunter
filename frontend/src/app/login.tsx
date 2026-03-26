import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, loginUser } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  async function handleLogin() {
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      const { accessToken, refreshToken } = await loginUser(username, password);
      login(accessToken, refreshToken);
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invaders Hunter</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleLogin}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.bg} />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/register')} style={styles.registerLink}>
          <Text style={styles.registerText}>No account? <Text style={styles.registerHighlight}>Create one</Text></Text>
        </Pressable>

        <Pressable onPress={() => router.push('/forgot-password')} style={styles.registerLink}>
          <Text style={styles.registerText}><Text style={styles.registerHighlight}>Forgot password?</Text></Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.five,
    },
    title: {
      color: t.accent,
      fontSize: FontSize.xl,
      fontWeight: 'bold',
      marginBottom: 48,
      letterSpacing: 2,
    },
    form: {
      width: '100%',
      maxWidth: 360,
      gap: Spacing.three,
    },
    input: {
      backgroundColor: t.bgElement,
      color: t.text,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.three,
      fontSize: FontSize.md,
    },
    error: {
      color: t.danger,
      fontSize: FontSize.sm,
      textAlign: 'center',
    },
    button: {
      backgroundColor: t.accent,
      borderRadius: BorderRadius.sm,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonText: {
      color: t.bg,
      fontWeight: 'bold',
      fontSize: FontSize.md,
    },
    registerLink: {
      alignItems: 'center',
    },
    registerText: {
      color: t.textMuted,
      fontSize: FontSize.sm,
    },
    registerHighlight: {
      color: t.accent,
    },
  });
}

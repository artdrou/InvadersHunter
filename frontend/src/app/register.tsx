import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, registerUser } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  async function handleRegister() {
    if (!username || !email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const token = await registerUser(username, email, password);
      login(token);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>InvadersHunter</Text>

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
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
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
          onPress={handleRegister}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.bg} />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.loginLink}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginHighlight}>Login</Text></Text>
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
    loginLink: {
      alignItems: 'center',
    },
    loginText: {
      color: t.textMuted,
      fontSize: FontSize.sm,
    },
    loginHighlight: {
      color: t.accent,
    },
  });
}

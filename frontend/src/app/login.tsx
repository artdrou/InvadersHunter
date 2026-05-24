import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore, loginUser } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, TitleFont, ButtonFont } from '@/constants/theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  async function handleLogin() {
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      const { accessToken, refreshToken } = await loginUser(username, password);
      login(accessToken, refreshToken);
    } catch {
      setError(t('auth.login.invalid'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.appTitle')}</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={t('auth.username')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
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
            <Text style={styles.buttonText}>{t('auth.login.button')}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/register')} style={styles.registerLink}>
          <Text style={styles.registerText}>{t('auth.login.noAccount')} <Text style={styles.registerHighlight}>{t('auth.login.createOne')}</Text></Text>
        </Pressable>

        <Pressable onPress={() => router.push('/forgot-password')} style={styles.registerLink}>
          <Text style={styles.registerText}><Text style={styles.registerHighlight}>{t('auth.login.forgotPassword')}</Text></Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
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
      fontSize: sz(FontSize.xl),
      fontFamily: TitleFont,
      marginBottom: 48,
      letterSpacing: 2,
      textAlign: 'center',
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
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    error: {
      color: t.danger,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
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
      fontFamily: ButtonFont,
      fontSize: FontSize.md,
    },
    registerLink: {
      alignItems: 'center',
    },
    registerText: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    registerHighlight: {
      color: t.accent,
      fontFamily: font,
    },
  });
}

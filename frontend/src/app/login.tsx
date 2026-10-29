import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore, loginUser, isEmailNotVerified, AuthLayout } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { hapticTap } from '@/features/settings';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel } from '@/constants/arcade-button';
import { PasswordInput } from '@/components/ui/PasswordInput';


export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const enterGuestMode = useAuthStore((s) => s.enterGuestMode);
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  async function handleLogin() {
    if (!username || !password) return;
    hapticTap();
    setLoading(true);
    setError(null);
    try {
      const { accessToken, refreshToken } = await loginUser(username, password);
      login(accessToken, refreshToken);
    } catch (e) {
      if (isEmailNotVerified(e)) {
        router.push({ pathname: '/verify-email', params: { username } });
        return;
      }
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(t(status === 429 ? 'auth.login.tooMany' : 'auth.login.invalid'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={t('auth.username')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <PasswordInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textMuted}
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

        <Pressable
          onPress={() => { hapticTap(); enterGuestMode(); router.replace('/(tabs)/map'); }}
          style={styles.guestLink}
        >
          <Text style={styles.registerText}><Text style={styles.registerHighlight}>{t('auth.login.guestMode')}</Text></Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
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
      ...arcadeButton(t),
      borderRadius: BorderRadius.sm,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonText: {
      ...arcadeButtonLabel(t),
      fontSize: FontSize.xxl,
    },
    registerLink: {
      alignItems: 'center',
    },
    guestLink: {
      alignItems: 'center',
      marginTop: Spacing.three,
      alignSelf: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 10,
      paddingHorizontal: Spacing.four,
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

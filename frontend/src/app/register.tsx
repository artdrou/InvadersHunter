import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore, registerUser, AuthLayout } from '@/features/auth';
import { apiErrorDetail } from '@/services/api-client';
import { useTheme } from '@/contexts/theme-context';
import { hapticTap } from '@/features/settings';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel, arcadeLabelColor } from '@/constants/arcade-button';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  async function handleRegister() {
    if (!username || !email || !password) return;
    hapticTap();
    setLoading(true);
    setError(null);
    try {
      const { accessToken, refreshToken } = await registerUser(username, email, password);
      login(accessToken, refreshToken);
    } catch (err) {
      setError(apiErrorDetail(err) ?? t('auth.register.failed'));
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
        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
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
          onPress={handleRegister}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={arcadeLabelColor(theme)} />
          ) : (
            <Text style={styles.buttonText}>{t('auth.register.button')}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.loginLink}>
          <Text style={styles.loginText}>{t('auth.register.alreadyAccount')} <Text style={styles.loginHighlight}>{t('auth.register.loginLink')}</Text></Text>
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
    loginLink: {
      alignItems: 'center',
    },
    loginText: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    loginHighlight: {
      color: t.accent,
      fontFamily: font,
    },
  });
}

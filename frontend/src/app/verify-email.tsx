/**
 * Email check after sign-up: the 6-digit code from the verification email logs the
 * account in. Opened by register / login when the server answers "not verified"
 * (403). The email also has a link: after tapping it, the user just logs in.
 */
import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore, verifyEmail, resendVerification, AuthLayout } from '@/features/auth';
import { apiErrorDetail } from '@/services/api-client';
import { useTheme } from '@/contexts/theme-context';
import { hapticTap } from '@/features/settings';
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel, arcadeLabelColor } from '@/constants/arcade-button';

export default function VerifyEmailScreen() {
  const { username = '' } = useLocalSearchParams<{ username: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  async function handleVerify() {
    if (code.length < 6) return;
    hapticTap();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { accessToken, refreshToken } = await verifyEmail(username, code);
      login(accessToken, refreshToken);
    } catch (err) {
      const detail = apiErrorDetail(err);
      if (detail === 'already_verified') {
        router.replace('/login');
        return;
      }
      setError(t(detail === 'too_many' ? 'auth.verify.tooMany' : 'auth.verify.invalidCode'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    hapticTap();
    setError(null);
    try {
      await resendVerification(username);
      setInfo(t('auth.verify.resent'));
    } catch {
      setError(t('auth.forgot.somethingWrong'));
    }
  }

  return (
    <AuthLayout>
      <View style={styles.form}>
        <Text style={styles.subtitle}>{t('auth.verify.title')}</Text>
        <Text style={styles.body}>{t('auth.verify.body')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('auth.forgot.sixDigit')}
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleVerify}
          disabled={loading}>
          {loading ? <ActivityIndicator color={arcadeLabelColor(theme)} /> : <Text style={styles.buttonText}>{t('auth.forgot.verify')}</Text>}
        </Pressable>
        <Pressable onPress={handleResend} style={styles.link}>
          <Text style={styles.linkText}>{t('auth.verify.resend')}</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.replace('/login')} style={styles.backLink}>
        <Text style={styles.backText}>{t('auth.forgot.backToLogin')}</Text>
      </Pressable>
    </AuthLayout>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    subtitle: {
      color: t.text,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    body: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      marginBottom: Spacing.two,
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
      textAlign: 'center',
      letterSpacing: 6,
    },
    error: {
      color: t.danger,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      textAlign: 'center',
    },
    info: {
      color: t.success,
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
    link: {
      alignItems: 'center',
    },
    linkText: {
      color: t.accent,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    backLink: {
      marginTop: Spacing.five,
    },
    backText: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
  });
}

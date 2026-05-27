import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { forgotPassword, verifyResetCode, resetPassword } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontSize } from '@/constants/theme';

type Step = 'request' | 'verify' | 'new-password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const [step, setStep] = useState<Step>('request');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    if (!username || !email) return;
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(username, email);
      setStep('verify');
    } catch {
      setError(t('auth.forgot.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      await verifyResetCode(email, code);
      setStep('new-password');
    } catch {
      setError(t('auth.forgot.invalidCode'));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      setError(t('auth.forgot.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email, code, newPassword);
      router.replace('/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('auth.forgot.invalidCode'));
      setStep('verify');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.appTitleSmall')}</Text>

      <View style={styles.form}>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>{t('auth.forgot.unavailable')}</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', fontSize: 13 }]}>{t('auth.forgot.contactSupport')}</Text>
      </View>

      {false && step === 'request' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>{t('auth.forgot.resetTitle')}</Text>
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
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleRequest}
            disabled={loading}>
            {loading ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.buttonText}>{t('auth.forgot.sendCode')}</Text>}
          </Pressable>
        </View>
      )}

      {false && step === 'verify' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>{t('auth.forgot.codePrompt')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.forgot.sixDigit')}
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleVerify}
            disabled={loading}>
            {loading ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.buttonText}>{t('auth.forgot.verify')}</Text>}
          </Pressable>
        </View>
      )}

      {false && step === 'new-password' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>{t('auth.forgot.newPasswordTitle')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.forgot.newPassword')}
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TextInput
            style={[
              styles.input,
              confirmPassword.length > 0 && (
                newPassword === confirmPassword
                  ? styles.inputValid
                  : styles.inputInvalid
              ),
            ]}
            placeholder={t('auth.forgot.confirmPassword')}
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleReset}
            disabled={loading}>
            {loading ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.buttonText}>{t('auth.forgot.updatePassword')}</Text>}
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>{t('auth.forgot.backToLogin')}</Text>
      </Pressable>
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
      fontFamily: font,
      marginBottom: 48,
      letterSpacing: 2,
    },
    subtitle: {
      color: t.text,
      fontSize: sz(FontSize.md),
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
    },
    inputValid: {
      backgroundColor: t.bgInputValid,
      borderColor: t.borderInputValid,
    },
    inputInvalid: {
      backgroundColor: t.bgInputInvalid,
      borderColor: t.borderInputInvalid,
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
      fontSize: ButtonFontSize.xxl,
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

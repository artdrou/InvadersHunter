import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { forgotPassword, verifyResetCode, resetPassword } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';

type Step = 'request' | 'verify' | 'new-password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
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
      setError('Something went wrong, please try again');
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
      setError('Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email, code, newPassword);
      router.replace('/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Invalid or expired code');
      setStep('verify');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invaders Hunter</Text>

      {step === 'request' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>Reset your password</Text>
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
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleRequest}
            disabled={loading}>
            {loading ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.buttonText}>Send code</Text>}
          </Pressable>
        </View>
      )}

      {step === 'verify' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>Enter the code sent to your email</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
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
            {loading ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.buttonText}>Verify</Text>}
          </Pressable>
        </View>
      )}

      {step === 'new-password' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>Choose a new password</Text>
          <TextInput
            style={styles.input}
            placeholder="New password"
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
            placeholder="Confirm password"
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
            {loading ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.buttonText}>Update password</Text>}
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>Back to login</Text>
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
      fontSize: FontSize.md,
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

import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { forgotPassword, verifyResetCode, resetPassword } from '@/features/auth';

type Step = 'request' | 'verify' | 'new-password';

export default function ForgotPasswordScreen() {
  const router = useRouter();

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
            placeholderTextColor="#666"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
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
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Send code</Text>}
          </Pressable>
        </View>
      )}

      {step === 'verify' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>Enter the code sent to your email</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            placeholderTextColor="#666"
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
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Verify</Text>}
          </Pressable>
        </View>
      )}

      {step === 'new-password' && (
        <View style={styles.form}>
          <Text style={styles.subtitle}>Choose a new password</Text>
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor="#666"
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
            placeholderTextColor="#666"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleReset}
            disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Update password</Text>}
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>Back to login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    color: '#ffd000',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 48,
    letterSpacing: 2,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  form: {
    width: '100%',
    maxWidth: 360,
    gap: 16,
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  error: {
    color: '#ff0062',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ffd000',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backLink: {
    marginTop: 32,
  },
  backText: {
    color: '#666',
    fontSize: 14,
  },
  inputValid: {
    backgroundColor: '#0a2a1a',
    borderColor: '#1cffb7',
  },
  inputInvalid: {
    backgroundColor: '#2a0a0a',
    borderColor: '#ff0062',
  },
});

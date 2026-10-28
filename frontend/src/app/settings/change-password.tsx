import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap, hapticSuccess } from '@/features/settings';
import { changeMyPassword } from '@/features/auth';
import { arcadeButton, arcadeButtonLabel, arcadeCard, arcadeLabelColor } from '@/constants/arcade-button';
import { PasswordInput } from '@/components/ui/PasswordInput';

const MIN_LENGTH = 4;  // same rule as sign-up and password reset (backend schemas)

/** Signed-in password change: current password, then the new one twice. */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (saving) return;
    if (!current || next.length < MIN_LENGTH) {
      setError(t('settings.changePasswordTooShort', { count: MIN_LENGTH }));
      return;
    }
    if (next !== confirm) {
      setError(t('settings.changePasswordMismatch'));
      return;
    }
    hapticTap();
    setSaving(true);
    setError(null);
    try {
      await changeMyPassword(current, next);
      hapticSuccess();
      setDone(true);
    } catch (err) {
      const detail = isAxiosError(err) ? err.response?.data?.detail : undefined;
      setError(
        detail === 'wrong_password' ? t('settings.changePasswordWrong')
          : detail === 'too_many' ? t('settings.changePasswordTooMany')
          : t('settings.actionFailed'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <SettingsShell title={t('settings.changePassword')}>
        <View style={styles.card}>
          <Text style={styles.doneTitle}>{t('settings.changePasswordDoneTitle')}</Text>
          <Text style={styles.body}>{t('settings.changePasswordDoneBody')}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={() => router.back()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </Pressable>
      </SettingsShell>
    );
  }

  const mismatch = confirm.length > 0 && confirm !== next;

  return (
    <SettingsShell title={t('settings.changePassword')}>
      <View style={styles.card}>
        <PasswordInput
          style={styles.input}
          placeholder={t('settings.changePasswordCurrent')}
          placeholderTextColor={theme.textMuted}
          value={current}
          onChangeText={(v) => { setCurrent(v); setError(null); }}
        />
        <PasswordInput
          style={styles.input}
          placeholder={t('settings.changePasswordNew')}
          placeholderTextColor={theme.textMuted}
          value={next}
          onChangeText={(v) => { setNext(v); setError(null); }}
        />
        <PasswordInput
          style={[styles.input, confirm.length > 0 && (mismatch ? styles.inputInvalid : styles.inputValid)]}
          placeholder={t('settings.changePasswordConfirm')}
          placeholderTextColor={theme.textMuted}
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setError(null); }}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
      <Pressable
        style={({ pressed }) => [styles.btn, saving && styles.disabled, pressed && styles.pressed]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={arcadeLabelColor(theme)} />
          : <Text style={styles.btnText}>{t('settings.changePasswordSave')}</Text>}
      </Pressable>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    card: { ...arcadeCard(t), padding: Spacing.three, gap: Spacing.three },
    input: {
      backgroundColor: t.bg,
      color: t.text,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.three,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    inputValid: { backgroundColor: t.bgInputValid, borderColor: t.borderInputValid },
    inputInvalid: { backgroundColor: t.bgInputInvalid, borderColor: t.borderInputInvalid },
    error: { color: t.danger, fontFamily: ButtonFont, fontSize: FontSize.sm, textAlign: 'center' },
    doneTitle: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.lg },
    body: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm, lineHeight: 22 },
    btn: {
      ...arcadeButton(t),
      borderRadius: BorderRadius.sm,
      paddingVertical: 14,
      alignItems: 'center',
    },
    btnText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
    disabled: { opacity: 0.6 },
    pressed: { opacity: 0.7 },
  });
}

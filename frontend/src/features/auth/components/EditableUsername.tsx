import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { useAuthStore } from '../store';
import { updateMyUsername } from '../services/account.api';

// Same bounds as the backend (UserUpdate.username).
const MIN_LENGTH = 3;
const MAX_LENGTH = 50;

type ErrorKey = 'tooShort' | 'taken' | 'failed';

/** The signed-in user's username, with an inline "edit" to rename the account. */
export function EditableUsername() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const user = useAuthStore((s) => s.user);
  const setUsername = useAuthStore((s) => s.setUsername);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  if (!user) return null;

  function startEditing() {
    setDraft(user!.username);
    setError(null);
    setEditing(true);
  }

  async function save() {
    const name = draft.trim();
    if (name === user!.username) {
      setEditing(false);
      return;
    }
    if (name.length < MIN_LENGTH) {
      setError('tooShort');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMyUsername(user!.id, name);
      setUsername(name);
      setEditing(false);
    } catch (e) {
      setError(isAxiosError(e) && e.response?.status === 400 ? 'taken' : 'failed');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Pressable style={({ pressed }) => [styles.cell, pressed && styles.pressed]} onPress={startEditing}>
        <Text style={styles.value} numberOfLines={1}>{user.username}</Text>
        <Ionicons name="create-outline" size={18} color={theme.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={styles.editWrap}>
      <View style={[styles.cell, { borderColor: theme.accent }]}>
        <TextInput
          value={draft}
          onChangeText={(v) => { setDraft(v); setError(null); }}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={MAX_LENGTH}
          editable={!saving}
          onSubmitEditing={save}
          returnKeyType="done"
          style={[styles.value, styles.input]}
        />
        {saving ? <ActivityIndicator color={theme.accent} /> : null}
      </View>
      {error ? <Text style={styles.error}>{t(`profile.username_${error}`, { min: MIN_LENGTH })}</Text> : null}
      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => setEditing(false)}
          disabled={saving}
        >
          <Text style={styles.btnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
          onPress={save}
          disabled={saving}
        >
          <Text style={[styles.btnText, { color: theme.accent }]}>{t('profile.usernameSave')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    // Same look as the profile InfoCell.
    cell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    value: { flex: 1, color: t.accent, fontFamily: ButtonFont, fontSize: FontSize.md },
    input: { padding: 0 },
    editWrap: { gap: Spacing.two },
    error: { color: t.danger, fontFamily: ButtonFont, fontSize: FontSize.xs, paddingHorizontal: Spacing.two },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
    btn: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
    },
    btnPrimary: { borderColor: t.accent },
    btnText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.sm },
    pressed: { opacity: 0.6 },
  });
}

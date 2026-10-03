import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, Modal, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont, FontSize, Spacing, BorderRadius } from '@/constants/theme';

// Deliberately loud: used for irreversible admin actions (deleting an invader / a user).
export const DANGER_RED = '#C8102E';
const CONFIRM_WORD = 'DELETE';

type Props = {
  title: string;
  body: string;
  confirmLabel: string;
  failedLabel: string;
  /** Runs once "DELETE" is typed and confirmed; a rejected promise shows `failedLabel`. */
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

/** Full-screen red confirmation that only arms once the admin types DELETE. */
export function DangerConfirmScreen({ title, body, confirmLabel, failedLabel, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const { appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const armed = typed.trim() === CONFIRM_WORD && !busy;

  async function handleConfirm() {
    setBusy(true);
    setError(false);
    try {
      await onConfirm();
    } catch {
      setBusy(false);
      setError(true);
    }
  }

  const white = (size: number) => ({ fontFamily: appFont, fontSize: sz(size), color: '#FFFFFF' });

  return (
    <Modal visible animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <MaterialCommunityIcons name="alert-octagon" size={84} color="#FFFFFF" />
          <Text style={[white(FontSize.xl), styles.center]}>{title}</Text>
          <Text style={[white(FontSize.sm), styles.center, styles.body]}>{body}</Text>
          <Text style={[white(FontSize.sm), styles.center]}>{t('adminDelete.typeToConfirm', { word: CONFIRM_WORD })}</Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={CONFIRM_WORD}
            placeholderTextColor="rgba(255,255,255,0.45)"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            editable={!busy}
            style={[styles.input, { fontFamily: appFont, fontSize: sz(FontSize.lg) }]}
          />
          {error ? <Text style={[white(FontSize.xs), styles.center]}>{failedLabel}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.confirmBtn, !armed && styles.disabled, pressed && armed && styles.pressed]}
            onPress={handleConfirm}
            disabled={!armed}
          >
            {busy ? (
              <ActivityIndicator color={DANGER_RED} />
            ) : (
              <Text style={[styles.confirmText, { fontFamily: ButtonFont, fontSize: sz(FontSize.md) }]}>
                {confirmLabel}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            onPress={onCancel}
            disabled={busy}
          >
            <Text style={[white(FontSize.md), { fontFamily: ButtonFont }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  screen: {
    flex: 1,
    backgroundColor: DANGER_RED,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  center: { textAlign: 'center' },
  body: { opacity: 0.92, lineHeight: 22 },
  input: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 4,
  },
  actions: { gap: Spacing.two },
  confirmBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmText: { color: DANGER_RED },
  disabled: { opacity: 0.35 },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
  },
});

import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, Modal, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { deleteInvadersByIds } from '@/services/db';
import { useAuthStore } from '@/features/auth/store';
import { useInvaderStore } from '@/features/invaders/store';
import * as haptics from '@/features/settings/haptics';
import { deleteInvader } from '../services/admin.api';

// Deliberately loud: this wipes the invader for every user, with no undo.
const DANGER_RED = '#C8102E';
const CONFIRM_WORD = 'DELETE';

type Props = {
  invaderId: number;
  invaderName: string;
  /** Called once the invader is gone (server + local cache), e.g. to close the popup. */
  onDeleted: () => void;
};

/** Admin-only "delete invader" button + red confirmation screen (type DELETE). Renders nothing for non-admins. */
export function DeleteInvaderButton({ invaderId, invaderName, onDeleted }: Props) {
  const isAdmin = useAuthStore((s) => s.user?.is_admin ?? false);
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  if (!isAdmin) return null;

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.triggerBtn, pressed && styles.pressed]}
        onPress={() => { haptics.disappoint(); setOpen(true); }}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={DANGER_RED} />
        <Text style={[styles.triggerText, { fontFamily: ButtonFont, fontSize: sz(FontSize.sm) }]}>
          {t('adminDelete.button')}
        </Text>
      </Pressable>
      {open ? (
        <ConfirmScreen
          invaderId={invaderId}
          invaderName={invaderName}
          onCancel={() => setOpen(false)}
          onDeleted={() => { setOpen(false); onDeleted(); }}
        />
      ) : null}
    </>
  );
}

function ConfirmScreen({ invaderId, invaderName, onCancel, onDeleted }: {
  invaderId: number;
  invaderName: string;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const { appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const setInvaders = useInvaderStore((s) => s.setInvaders);
  const setProgress = useInvaderStore((s) => s.setProgress);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  const armed = typed.trim() === CONFIRM_WORD && !deleting;

  async function handleDelete() {
    setDeleting(true);
    setError(false);
    try {
      await deleteInvader(invaderId);
      // Drop it locally right away; other devices get it via the deleted_invaders tombstone.
      await deleteInvadersByIds(db, [invaderId]).catch(() => {});
      setInvaders(useInvaderStore.getState().invaders.filter((i) => i.id !== invaderId));
      setProgress((prev) => prev.filter((c) => c.invader_id !== invaderId));
      haptics.success();
      onDeleted();
    } catch {
      setDeleting(false);
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
          <Text style={[white(FontSize.xl), styles.center]}>{t('adminDelete.title', { name: invaderName })}</Text>
          <Text style={[white(FontSize.sm), styles.center, styles.body]}>{t('adminDelete.body')}</Text>
          <Text style={[white(FontSize.sm), styles.center]}>{t('adminDelete.typeToConfirm', { word: CONFIRM_WORD })}</Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={CONFIRM_WORD}
            placeholderTextColor="rgba(255,255,255,0.45)"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            editable={!deleting}
            style={[styles.input, { fontFamily: appFont, fontSize: sz(FontSize.lg) }]}
          />
          {error ? <Text style={[white(FontSize.xs), styles.center]}>{t('adminDelete.failed')}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.confirmBtn, !armed && styles.disabled, pressed && armed && styles.pressed]}
            onPress={handleDelete}
            disabled={!armed}
          >
            {deleting ? (
              <ActivityIndicator color={DANGER_RED} />
            ) : (
              <Text style={[styles.confirmText, { fontFamily: ButtonFont, fontSize: sz(FontSize.md) }]}>
                {t('adminDelete.confirm')}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            onPress={onCancel}
            disabled={deleting}
          >
            <Text style={[white(FontSize.md), { fontFamily: ButtonFont }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingVertical: 11,
    borderWidth: 2,
    borderColor: DANGER_RED,
    borderRadius: BorderRadius.sm,
  },
  triggerText: { color: DANGER_RED },
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

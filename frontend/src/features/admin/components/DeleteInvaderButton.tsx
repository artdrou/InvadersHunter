import { useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { deleteInvadersByIds } from '@/services/db';
import { useAuthStore } from '@/features/auth/store';
import { useInvaderStore } from '@/features/invaders/store';
import * as haptics from '@/features/settings/haptics';
import { deleteInvader } from '../services/admin.api';
import { DangerConfirmScreen, DANGER_RED } from './DangerConfirmScreen';

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
  const db = useSQLiteContext();
  const setInvaders = useInvaderStore((s) => s.setInvaders);
  const setProgress = useInvaderStore((s) => s.setProgress);
  const sz = (n: number) => Math.round(n * fontScale);

  if (!isAdmin) return null;

  async function handleDelete() {
    await deleteInvader(invaderId);
    // Drop it locally right away; other devices get it via the deleted_invaders tombstone.
    await deleteInvadersByIds(db, [invaderId]).catch(() => {});
    setInvaders(useInvaderStore.getState().invaders.filter((i) => i.id !== invaderId));
    setProgress((prev) => prev.filter((c) => c.invader_id !== invaderId));
    haptics.success();
    setOpen(false);
    onDeleted();
  }

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
        <DangerConfirmScreen
          title={t('adminDelete.title', { name: invaderName })}
          body={t('adminDelete.body')}
          confirmLabel={t('adminDelete.confirm')}
          failedLabel={t('adminDelete.failed')}
          onConfirm={handleDelete}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </>
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
});

import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store';
import * as haptics from '@/features/settings/haptics';
import { setUserAdmin, deleteUser } from '../services/admin.api';
import type { AdminUserProfile } from '../types';
import { DangerConfirmScreen, DANGER_RED } from './DangerConfirmScreen';

type Props = {
  profile: AdminUserProfile;
  /** Role changed: reload the profile. */
  onChanged: () => void;
  /** Account deleted: leave the page. */
  onDeleted: () => void;
};

/** Admin actions on a user's profile page: promote / demote, delete. Hidden on your own profile. */
export function UserAdminActions({ profile, onChanged, onDeleted }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const myId = useAuthStore((s) => s.user?.id);
  const [roleBusy, setRoleBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (myId === profile.id) {
    return <Text style={styles.note}>{t('adminUsers.selfNote')}</Text>;
  }

  const promoting = !profile.is_admin;

  function askRoleChange() {
    haptics.tap();
    Alert.alert(
      t(promoting ? 'adminUsers.promoteTitle' : 'adminUsers.demoteTitle', { name: profile.username }),
      t(promoting ? 'adminUsers.promoteBody' : 'adminUsers.demoteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(promoting ? 'adminUsers.promote' : 'adminUsers.demote'),
          style: promoting ? 'default' : 'destructive',
          onPress: async () => {
            setRoleBusy(true);
            try {
              await setUserAdmin(profile.id, promoting);
              haptics.success();
              onChanged();
            } catch {
              Alert.alert(t('adminUsers.actionFailed'));
            } finally {
              setRoleBusy(false);
            }
          },
        },
      ],
    );
  }

  async function handleDelete() {
    await deleteUser(profile.id);
    haptics.success();
    setConfirmDelete(false);
    onDeleted();
  }

  return (
    <View style={styles.actions}>
      <Pressable
        style={({ pressed }) => [styles.btn, { borderColor: theme.accent }, pressed && styles.pressed]}
        onPress={askRoleChange}
        disabled={roleBusy}
      >
        {roleBusy ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <>
            <Ionicons name={promoting ? 'shield-checkmark-outline' : 'shield-outline'} size={18} color={theme.accent} />
            <Text style={[styles.btnText, { color: theme.accent }]}>
              {t(promoting ? 'adminUsers.promote' : 'adminUsers.demote')}
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btn, { borderColor: DANGER_RED }, pressed && styles.pressed]}
        onPress={() => { haptics.disappoint(); setConfirmDelete(true); }}
      >
        <Ionicons name="trash-outline" size={18} color={DANGER_RED} />
        <Text style={[styles.btnText, { color: DANGER_RED }]}>{t('adminUsers.deleteUser')}</Text>
      </Pressable>

      {confirmDelete ? (
        <DangerConfirmScreen
          title={t('adminUsers.deleteTitle', { name: profile.username })}
          body={t('adminUsers.deleteBody')}
          confirmLabel={t('adminUsers.deleteConfirm')}
          failedLabel={t('adminUsers.actionFailed')}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    actions: { gap: Spacing.two },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      paddingVertical: 12,
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
    },
    btnText: { fontFamily: ButtonFont, fontSize: FontSize.md },
    pressed: { opacity: 0.6 },
    note: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, textAlign: 'center' },
  });
}

import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { GOOGLE_MAPS_DIR_URL } from '@/constants/config';
import { STATE_KEYS } from '@/features/invaders/state-options';
import { makeStyles } from '@/features/map/components/InvaderPopup/styles';
import { PopupShell } from '@/features/map/components/InvaderPopup/PopupShell';
import { formatDate } from '@/features/map/components/InvaderPopup/format';
import type { CustomInvader } from '../types';

type Props = {
  invader: CustomInvader;
  onClose: () => void;
  onEdit: (invader: CustomInvader) => void;
  onDelete: (invader: CustomInvader) => void;
  onHeightChange?: (height: number) => void;
};

/**
 * Popup for a personal invader. Deliberately thinner than {@link InvaderPopup}:
 * a personal invader has no flash, no comment wall and no contributors — it's
 * the owner's own marker, so the only actions are edit and delete.
 */
export function CustomInvaderPopup({ invader, onClose, onEdit, onDelete, onHeightChange }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  function confirmDelete() {
    Alert.alert(
      t('customInvaders.deleteTitle'),
      t('customInvaders.deleteMessage', { name: invader.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('customInvaders.delete'), style: 'destructive', onPress: () => onDelete(invader) },
      ],
    );
  }

  return (
    <PopupShell styles={styles} onHeightChange={onHeightChange}>
      <View style={styles.header}>
        <Text style={styles.name}>{invader.name}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoBlock}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('customInvaders.badge')}</Text>
          <Text style={[styles.value, { color: theme.accent }]}>{t('customInvaders.badgeValue')}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.points')}</Text>
          <Text style={styles.value}>{invader.points ?? '--'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.state')}</Text>
          <Text style={styles.value}>
            {invader.state ? t(STATE_KEYS[invader.state] ?? invader.state) : '--'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.posed')}</Text>
          <Text style={styles.value}>{formatDate(invader.date_pose ?? undefined)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.linksRow}>
        <Pressable
          onPress={() => Linking.openURL(GOOGLE_MAPS_DIR_URL(invader.latitude, invader.longitude))}
          style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
          hitSlop={8}
        >
          <Ionicons name="navigate" size={20} color={theme.accent} />
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.flashBtn, styles.doFlashBtn, pressed && styles.btnPressed]}
        onPress={() => onEdit(invader)}
      >
        <Text style={styles.flashBtnText}>{t('customInvaders.edit')}</Text>
      </Pressable>

      <Pressable
        onPress={confirmDelete}
        style={({ pressed }) => [styles.modifyLink, pressed && styles.btnPressed]}
      >
        <Text style={[styles.modifyLinkText, { color: theme.danger }]}>
          {t('customInvaders.delete')}
        </Text>
      </Pressable>
    </PopupShell>
  );
}

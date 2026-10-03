import { Modal, View, Text, Pressable } from 'react-native';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useAppUpdateStore } from '../store';
import { makeUpdateModalStyles as makeStyles } from './update-modal-styles';

/** Offers to restart once `useOtaUpdateCheck` has downloaded an OTA bundle. */
export function OtaReadyModal() {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const otaReady = useAppUpdateStore((s) => s.otaReady);
  const dismissOta = useAppUpdateStore((s) => s.dismissOta);

  if (!otaReady) return null;

  function handleRestart() {
    // Restarts JS on the fetched bundle; on failure it applies at next launch.
    Updates.reloadAsync().catch(dismissOta);
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismissOta}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('appUpdate.otaTitle')}</Text>
          <Text style={styles.body}>{t('appUpdate.otaBody')}</Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={handleRestart}>
            <Text style={styles.primaryBtnText}>{t('appUpdate.otaRestart')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={dismissOta}>
            <Text style={styles.secondaryBtnText}>{t('appUpdate.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

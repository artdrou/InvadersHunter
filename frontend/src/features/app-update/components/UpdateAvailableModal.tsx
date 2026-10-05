import { Modal, View, Text, Pressable, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useAppUpdateStore } from '../store';
import { makeUpdateModalStyles as makeStyles } from './update-modal-styles';
import { resolveApkUrl, getCurrentVersion } from '../services/app-update.api';

export function UpdateAvailableModal() {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const manifest = useAppUpdateStore((s) => s.manifest);
  const isAvailable = useAppUpdateStore((s) => s.isAvailable);
  const dismiss = useAppUpdateStore((s) => s.dismiss);

  if (!manifest || !isAvailable) return null;

  function handleDownload() {
    if (!manifest) return;
    Linking.openURL(resolveApkUrl(manifest));
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('appUpdate.title')}</Text>
          <Text style={styles.body}>
            {t('appUpdate.body', { latest: manifest.latestVersion, current: getCurrentVersion() })}
          </Text>
          {manifest.notes ? <Text style={styles.notes}>{manifest.notes}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={handleDownload}>
            <Text style={styles.primaryBtnText}>{t('appUpdate.download')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={dismiss}>
            <Text style={styles.secondaryBtnText}>{t('appUpdate.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

import { Modal, View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { useAppUpdateStore } from '../store';
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

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.four,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.lg,
      padding: Spacing.four,
      gap: Spacing.two,
    },
    title: {
      color: t.accent,
      fontSize: sz(FontSize.lg),
      fontFamily: font,
      letterSpacing: 1,
      marginBottom: Spacing.one,
    },
    body: {
      color: t.text,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      lineHeight: 20,
    },
    notes: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm) - 1,
      fontFamily: font,
      fontStyle: 'italic',
      marginTop: Spacing.one,
    },
    primaryBtn: {
      backgroundColor: t.accent,
      borderRadius: BorderRadius.sm,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    primaryBtnText: {
      color: t.bg,
      fontFamily: ButtonFont,
      fontSize: FontSize.xxl,
    },
    secondaryBtn: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xl,
    },
    pressed: { opacity: 0.7 },
  });
}

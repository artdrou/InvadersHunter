import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { useAccountGateStore } from '../gate-store';

/**
 * App-styled replacement for the native alert shown when a guest taps an
 * account-only feature. Mounted once in the root layout; opened via
 * useRequireAccount().
 */
export function AccountGateModal() {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  const router = useRouter();

  const visible = useAccountGateStore((s) => s.visible);
  const close = useAccountGateStore((s) => s.close);

  if (!visible) return null;

  function handleCreate() {
    close();
    router.push('/register');
  }

  function handleLogin() {
    close();
    router.push('/login');
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('guest.gateTitle')}</Text>
          <Text style={styles.body}>{t('guest.gateMessage')}</Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={handleCreate}>
            <Text style={styles.primaryBtnText}>{t('guest.gateCreate')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={handleLogin}>
            <Text style={styles.outlineBtnText}>{t('guest.gateLogin')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={close}>
            <Text style={styles.secondaryBtnText}>{t('guest.gateCancel')}</Text>
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
    outlineBtn: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      alignItems: 'center',
    },
    outlineBtnText: {
      color: t.text,
      fontFamily: ButtonFont,
      fontSize: FontSize.xl,
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

import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';

// TODO: replace REPLACE_ME with the real Ko-fi handle once the account is created.
const DONATION_URL = 'https://ko-fi.com/drouuu';

export default function SupportScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const openDonation = async () => {
    hapticTap();
    try {
      await Linking.openURL(DONATION_URL);
    } catch {
      Alert.alert(t('common.error'), t('settings.supportLinkUnavailable'));
    }
  };

  return (
    <SettingsShell title={t('settings.support')}>
      <View style={styles.block}>
        <Text style={styles.body}>{t('settings.supportIntro')}</Text>
        <Text style={styles.body}>{t('settings.supportFree')}</Text>
        <Text style={styles.bodyMuted}>{t('settings.supportArtist')}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={openDonation}
        >
          <Text style={styles.btnText}>{t('settings.supportBtn')}</Text>
        </Pressable>
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    block: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    body: { color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.md, lineHeight: 22 },
    bodyMuted: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm, lineHeight: 20, fontStyle: 'italic' },
    btn: {
      paddingVertical: 12,
      borderRadius: BorderRadius.sm,
      backgroundColor: t.accent,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    btnText: { color: t.bg, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },
    pressed: { opacity: 0.6 },
  });
}

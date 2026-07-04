import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';

// Plus-aliased so we can filter contact mail in Gmail without exposing the
// real inbox address.
const DEV_EMAIL = 'invaderhunter.app+contact@gmail.com';

export default function ContactScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  return (
    <SettingsShell title={t('settings.contact')}>
      <View style={styles.block}>
        <Text style={styles.body}>{t('settings.contactBody')}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => { hapticTap(); Linking.openURL(`mailto:${DEV_EMAIL}`); }}
        >
          <Text style={styles.btnText}>{t('settings.contactEmail')}</Text>
        </Pressable>
      </View>
      <Text style={styles.notice}>{t('settings.contactNotice')}</Text>
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
    body: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md, lineHeight: 22 },
    btn: {
      paddingVertical: 12,
      borderRadius: BorderRadius.sm,
      backgroundColor: t.accent,
      alignItems: 'center',
    },
    btnText: { color: t.bg, fontFamily: ButtonFont, fontSize: FontSize.lg },
    pressed: { opacity: 0.6 },
    notice: {
      color: t.danger,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
      lineHeight: 18,
      textAlign: 'center',
      opacity: 0.85,
      paddingHorizontal: Spacing.two,
    },
  });
}

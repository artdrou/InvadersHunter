import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';

const DEV_EMAIL = 'a.drouadene@gmail.com';

export default function ContactScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <SettingsShell title={t('settings.contact')}>
      <View style={styles.block}>
        <Text style={styles.body}>{t('settings.contactBody')}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => Linking.openURL(`mailto:${DEV_EMAIL}`)}
        >
          <Text style={styles.btnText}>{t('settings.contactEmail')}</Text>
        </Pressable>
        <Text style={styles.email}>{DEV_EMAIL}</Text>
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
    btn: {
      paddingVertical: 12,
      borderRadius: BorderRadius.sm,
      backgroundColor: t.accent,
      alignItems: 'center',
    },
    btnText: { color: t.bg, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },
    pressed: { opacity: 0.6 },
    email: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm, textAlign: 'center' },
  });
}

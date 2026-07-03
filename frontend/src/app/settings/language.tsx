import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';
import { SUPPORTED_LANGUAGES, setLanguage, type LanguageCode } from '@/services/i18n';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const currentLang = i18n.language;

  async function handleChange(code: LanguageCode) { hapticTap(); await setLanguage(code); }

  return (
    <SettingsShell title={t('settings.language')}>
      <View style={styles.list}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = lang.code === currentLang;
          return (
            <Pressable
              key={lang.code}
              style={({ pressed }) => [
                styles.option,
                isActive && { borderColor: theme.accent },
                pressed && styles.pressed,
              ]}
              onPress={() => handleChange(lang.code)}
            >
              <Text style={[styles.optionText, isActive && { color: theme.accent }]}>
                {t(lang.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    list: { gap: Spacing.two },
    option: {
      paddingVertical: 14,
      paddingHorizontal: Spacing.three,
      alignItems: 'center',
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bgElement,
    },
    optionText: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.lg,
    },
    pressed: { opacity: 0.6 },
  });
}

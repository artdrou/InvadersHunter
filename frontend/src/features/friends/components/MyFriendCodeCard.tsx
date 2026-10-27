/**
 * My friend code on the Social tab, with Copy and Share. Friends type it in the
 * "Add a friend" field instead of an exact username.
 */
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Share, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont, ButtonFontBold, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';
import { tap as hapticTap, success as hapticSuccess } from '@/features/settings/haptics';
import { useFriendsStore } from '../store';

const COPIED_MS = 1500;

export function MyFriendCodeCard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const code = useFriendsStore((s) => s.myCode);
  const loadCode = useFriendsStore((s) => s.loadCode);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (!code) loadCode(); }, [code, loadCode]);

  async function copy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    hapticSuccess();
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  function share() {
    if (!code) return;
    hapticTap();
    Share.share({ message: t('social.codeShareMessage', { code }) });
  }

  const outline = arcadeButtonLabel(theme, 'outline');

  return (
    <View style={[styles.card, arcadeCard(theme)]}>
      <View style={styles.codeBlock}>
        <Text style={[styles.label, { color: theme.textMuted }]}>{t('social.myCode')}</Text>
        <Text style={[styles.code, { color: theme.accent }]} selectable>{code ?? '····-····'}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btn, arcadeButton(theme, 'outline'), (!code) && styles.disabled, pressed && styles.pressed]}
          onPress={copy}
          disabled={!code}
          accessibilityLabel={t('social.codeCopy')}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy'} size={18} color={outline.color} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.shareBtn, arcadeButton(theme), (!code) && styles.disabled, pressed && styles.pressed]}
          onPress={share}
          disabled={!code}
        >
          <Ionicons name="share-social" size={16} color={arcadeButtonLabel(theme).color} />
          <Text style={[arcadeButtonLabel(theme), styles.btnText]}>{t('social.codeShare')}</Text>
        </Pressable>
      </View>
      {copied ? (
        <ShadowText shadowColor={theme.titleShadow} style={[styles.copied, { color: theme.accent }]}>
          {t('social.codeCopied')}
        </ShadowText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  codeBlock: { flex: 1, gap: 2 },
  label: { fontFamily: ButtonFont, fontSize: FontSize.xs },
  code: { fontFamily: ButtonFontBold, fontSize: FontSize.xl, letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  btn: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: { flexDirection: 'row', gap: Spacing.one },
  btnText: { fontSize: FontSize.sm },
  copied: { fontFamily: ButtonFontBold, fontSize: FontSize.xs, width: '100%' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
});

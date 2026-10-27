/**
 * My friend code on the Social tab, with Copy and Share. Friends type it in the
 * "Add a friend" field instead of an exact username.
 */
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Share, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont, ButtonFontBold, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';
import { FloatingText, useFloatingText } from '@/components/FloatingText';
import { tap as hapticTap, success as hapticSuccess } from '@/features/settings/haptics';
import { BASE_URL } from '@/services/api-client';
import { useFriendsStore } from '../store';
import { friendLink } from '../utils';

const COPIED_MS = 1500;

/** expo-clipboard is a native module: loaded on first copy, so an APK built without
 *  it only loses the Copy button instead of crashing on start (the friends barrel is
 *  imported by the map tab). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export function MyFriendCodeCard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const code = useFriendsStore((s) => s.myCode);
  const loadCode = useFriendsStore((s) => s.loadCode);
  const [copied, setCopied] = useState(false);
  const floating = useFloatingText();

  useEffect(() => { if (!code) loadCode(); }, [code, loadCode]);

  async function copy() {
    if (!code) return;
    if (!(await copyToClipboard(code))) {
      share();  // no clipboard in this build: the share sheet still gets the code out
      return;
    }
    hapticSuccess();
    setCopied(true);
    floating.show();
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  function share() {
    if (!code) return;
    hapticTap();
    Share.share({ message: t('social.codeShareMessage', { code, link: friendLink(BASE_URL, code) }) });
  }

  const outline = arcadeButtonLabel(theme, 'outline');

  return (
    <View style={[styles.card, arcadeCard(theme)]}>
      <View style={styles.codeBlock}>
        <Text style={[styles.label, { color: theme.textMuted }]}>{t('social.myCode')}</Text>
        <Text style={[styles.code, { color: theme.accent }]} selectable>{code ?? '····-····'}</Text>
      </View>
      <View style={styles.actions}>
        <View>
          <Pressable
            style={({ pressed }) => [styles.btn, arcadeButton(theme, 'outline'), (!code) && styles.disabled, pressed && styles.pressed]}
            onPress={copy}
            disabled={!code}
            accessibilityLabel={t('social.codeCopy')}
          >
            <Ionicons name={copied ? 'checkmark' : 'copy'} size={18} color={outline.color} />
          </Pressable>
          {/* Floats up from the button, over the layout (nothing moves) */}
          <FloatingText progress={floating.progress} text={t('social.codeCopied')} style={styles.floating} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.shareBtn, arcadeButton(theme), (!code) && styles.disabled, pressed && styles.pressed]}
          onPress={share}
          disabled={!code}
        >
          <Ionicons name="share-social" size={16} color={arcadeButtonLabel(theme).color} />
          <Text style={[arcadeButtonLabel(theme), styles.btnText]}>{t('social.codeShare')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
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
  floating: { bottom: '100%', left: -80, right: -80, marginBottom: Spacing.one },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
});

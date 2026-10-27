import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFont, ButtonFontBold, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';
import { useAuthStore } from '@/features/auth';
import { sendContactMessage } from '@/features/contact';
import { arcadeButton, arcadeButtonLabel, arcadeCard, arcadeLabelColor } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 4000;

export default function ContactScreen() {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  const signedIn = useAuthStore((s) => s.user != null && !s.isGuest);

  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (sending) return;
    if (subject.trim().length < 3 || message.trim().length < 10) {
      setError(t('settings.contactTooShort'));
      return;
    }
    hapticTap();
    setSending(true);
    setError(null);
    try {
      await sendContactMessage({
        subject: subject.trim(),
        message: message.trim(),
        email: !signedIn && email.trim() ? email.trim() : undefined,
      });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 429
        ? t('settings.contactTooMany') : t('settings.contactFailed'));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <SettingsShell title={t('settings.contact')}>
        <View style={styles.block}>
          <Text style={styles.sentTitle}>{t('settings.contactSentTitle')}</Text>
          <Text style={styles.body}>{t('settings.contactSentBody')}</Text>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => setSent(false)}
          >
            <ShadowText shadowColor={theme.titleShadow} style={styles.secondaryBtnText}>{t('settings.contactNewMessage')}</ShadowText>
          </Pressable>
        </View>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title={t('settings.contact')}>
      <View style={styles.block}>
        <Text style={styles.body}>{t('settings.contactBody')}</Text>

        {!signedIn && (
          <TextInput
            style={styles.input}
            placeholder={t('settings.contactGuestEmail')}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder={t('settings.contactSubject')}
          placeholderTextColor={theme.textMuted}
          maxLength={SUBJECT_MAX}
          value={subject}
          onChangeText={setSubject}
        />
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder={t('settings.contactMessage')}
          placeholderTextColor={theme.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={MESSAGE_MAX}
          value={message}
          onChangeText={setMessage}
        />
        <Text style={styles.counter}>{message.length} / {MESSAGE_MAX}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.btn, (pressed || sending) && styles.pressed]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color={arcadeLabelColor(theme)} />
            : <Text style={styles.btnText}>{t('settings.contactSend')}</Text>}
        </Pressable>
      </View>
      <Text style={styles.notice}>{t('settings.contactNotice')}</Text>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    block: {
      ...arcadeCard(t),
      padding: Spacing.four,
      gap: Spacing.three,
    },
    body: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md, lineHeight: 22 },
    sentTitle: { color: t.success, fontFamily: ButtonFontBold, fontSize: FontSize.lg },
    input: {
      backgroundColor: t.bg,
      color: t.text,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.three,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    messageInput: { minHeight: 160 },
    counter: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
      textAlign: 'right',
      marginTop: -Spacing.two,
    },
    error: { color: t.danger, fontFamily: ButtonFont, fontSize: FontSize.sm, lineHeight: 20 },
    btn: {
      paddingVertical: 12,
      borderRadius: BorderRadius.sm,
      ...arcadeButton(t),
      alignItems: 'center',
    },
    btnText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
    secondaryBtn: {
      paddingVertical: 12,
      borderRadius: BorderRadius.sm,
      ...arcadeButton(t, 'outline'),
      alignItems: 'center',
    },
    secondaryBtnText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.md },
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

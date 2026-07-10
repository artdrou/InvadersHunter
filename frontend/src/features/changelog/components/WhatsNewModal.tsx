import { useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { useChangelogStore } from '../store';
import { latestRelease, notesForLanguage } from '../releases';

type Props = {
  /** Only show once the user is actually in the app (authenticated or guest). */
  enabled: boolean;
};

/**
 * "What's new" popup — shown once after each release (APK or OTA).
 * Compares the latest stamped release in releases.ts against the last
 * version the user acknowledged. Fresh installs never see it: the current
 * version is marked seen silently on first launch.
 */
export function WhatsNewModal({ enabled }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const lastSeenVersion = useChangelogStore((s) => s.lastSeenVersion);
  const hasHydrated = useChangelogStore((s) => s._hasHydrated);
  const markSeen = useChangelogStore((s) => s.markSeen);

  const latest = latestRelease();

  // Fresh install (nothing seen yet): mark silently, don't greet with a popup
  useEffect(() => {
    if (hasHydrated && enabled && latest && lastSeenVersion === null) {
      markSeen(latest.version);
    }
  }, [hasHydrated, enabled, latest, lastSeenVersion, markSeen]);

  if (!enabled || !hasHydrated || !latest) return null;
  if (lastSeenVersion === null || lastSeenVersion === latest.version) return null;

  const notes = notesForLanguage(latest, i18n.language);
  const dismiss = () => markSeen(latest.version);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('changelog.whatsNewTitle')}</Text>
          <Text style={styles.version}>{t('changelog.versionLabel', { version: latest.version })}</Text>

          <ScrollView style={styles.notes} contentContainerStyle={styles.notesContent}>
            {notes.map((note, i) => (
              <View key={i} style={styles.noteRow}>
                <Text style={styles.bullet}>{'▪'}</Text>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={dismiss}>
            <Text style={styles.primaryBtnText}>{t('changelog.gotIt')}</Text>
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
      maxHeight: '75%',
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
    },
    version: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    notes: {
      flexGrow: 0,
    },
    notesContent: {
      gap: Spacing.two,
      paddingVertical: Spacing.one,
    },
    noteRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      alignItems: 'flex-start',
    },
    bullet: {
      color: t.accent,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      lineHeight: 20,
    },
    noteText: {
      color: t.text,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      lineHeight: 20,
      flex: 1,
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
    pressed: { opacity: 0.7 },
  });
}

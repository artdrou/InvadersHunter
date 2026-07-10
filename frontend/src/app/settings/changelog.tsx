import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell } from '@/features/settings';
import { publishedReleases, notesForLanguage } from '@/features/changelog';

/** Full release-notes history — one card per stamped release. */
export default function ChangelogScreen() {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  return (
    <SettingsShell title={t('settings.changelog')}>
      <View style={styles.list}>
        {publishedReleases().map((release) => (
          <View key={release.version} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardVersion}>{t('changelog.versionLabel', { version: release.version })}</Text>
              {release.date && <Text style={styles.cardDate}>{release.date}</Text>}
            </View>
            {notesForLanguage(release, i18n.language).map((note, i) => (
              <View key={i} style={styles.noteRow}>
                <Text style={styles.bullet}>{'▪'}</Text>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    list: { gap: Spacing.two },
    card: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardVersion: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: FontSize.md,
    },
    cardDate: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
    },
    noteRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      alignItems: 'flex-start',
    },
    bullet: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: FontSize.sm,
      lineHeight: 20,
    },
    noteText: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.sm,
      lineHeight: 20,
      flex: 1,
    },
  });
}

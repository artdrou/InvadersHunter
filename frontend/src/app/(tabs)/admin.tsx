import { Alert } from 'react-native';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, ButtonFontSize, Spacing } from '@/constants/theme';
import { SettingsSection, SettingsRow } from '@/features/settings';

export default function AdminMenuScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, insets.top);

  function soon() {
    Alert.alert(t('settings.comingSoon'), t('settings.comingSoonBody'));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('tabs.admin')}</Text>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        <SettingsSection title={t('admin.sectionRequests')}>
          <SettingsRow
            icon="list-outline"
            label={t('admin.browseRequests')}
            subtitle={t('admin.browseRequestsSubtitle')}
            onPress={() => router.push('/admin/requests')}
          />
        </SettingsSection>

        <SettingsSection title={t('admin.sectionInvaders')}>
          <SettingsRow
            icon="add-circle-outline"
            label={t('admin.createInvader')}
            subtitle={t('admin.createInvaderSubtitle')}
            onPress={soon}
          />
          <SettingsRow
            icon="create-outline"
            label={t('admin.editInvader')}
            subtitle={t('admin.editInvaderSubtitle')}
            onPress={soon}
          />
          <SettingsRow
            icon="git-merge-outline"
            label={t('admin.mergeInvaders')}
            subtitle={t('admin.mergeInvadersSubtitle')}
            onPress={soon}
          />
        </SettingsSection>

        <SettingsSection title={t('admin.sectionUsers')}>
          <SettingsRow
            icon="person-outline"
            label={t('admin.searchUser')}
            subtitle={t('admin.searchUserSubtitle')}
            onPress={soon}
          />
          <SettingsRow
            icon="shield-outline"
            label={t('admin.moderators')}
            subtitle={t('admin.moderatorsSubtitle')}
            onPress={soon}
          />
        </SettingsSection>

        <SettingsSection title={t('admin.sectionTools')}>
          <SettingsRow
            icon="bar-chart-outline"
            label={t('admin.stats')}
            subtitle={t('admin.statsSubtitle')}
            onPress={soon}
          />
          <SettingsRow
            icon="chatbubbles-outline"
            label={t('admin.modoChat')}
            subtitle={t('admin.modoChatSubtitle')}
            onPress={soon}
          />
          <SettingsRow
            icon="download-outline"
            label={t('admin.exportData')}
            subtitle={t('admin.exportDataSubtitle')}
            onPress={soon}
          />
        </SettingsSection>

      </ScrollView>
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      paddingTop: topInset + Spacing.two,
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.three,
      gap: Spacing.two,
    },
    title: {
      color: t.accent,
      fontFamily: font,
      fontSize: ButtonFontSize.xl,
      letterSpacing: 1,
    },
    body: {
      gap: Spacing.two,
      paddingBottom: Spacing.six,
    },
  });
}

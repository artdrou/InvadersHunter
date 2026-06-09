import { View, Image, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Fonts, FontSize, BorderRadius, Spacing } from '@/constants/theme';

const flashUncap = require('../../../../assets/images/marker-50pts-flash-uncaptured.png');
const flashCap   = require('../../../../assets/images/marker-50pts-flash-captured.png');
const rarity10   = require('../../../../assets/images/marker-10pts-rarity.png');
const rarity50   = require('../../../../assets/images/marker-50pts-rarity.png');
const rarity100  = require('../../../../assets/images/marker-100pts-rarity.png');

export function ColorModeIllustration() {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[s.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <View style={s.half}>
        <Text style={[s.modeLabel, { color: theme.accent }]}>Flash</Text>
        <View style={s.markerRow}>
          <View style={s.markerCol}>
            <Image source={flashUncap} style={s.marker} resizeMode="contain" />
            <Text style={[s.caption, { color: theme.textMuted }]}>{t('tutorial.colorMode.labelUnflashed')}</Text>
          </View>
          <View style={s.markerCol}>
            <Image source={flashCap} style={s.marker} resizeMode="contain" />
            <Text style={[s.caption, { color: theme.textMuted }]}>{t('tutorial.colorMode.labelFlashed')}</Text>
          </View>
        </View>
      </View>

      <View style={[s.vDivider, { backgroundColor: theme.border }]} />

      <View style={s.half}>
        <Text style={[s.modeLabel, { color: theme.accent }]}>{t('invaders.colorRarity')}</Text>
        <View style={s.markerRow}>
          <View style={s.markerCol}>
            <Image source={rarity10} style={s.markerSm} resizeMode="contain" />
            <Text style={[s.caption, { color: theme.textMuted }]}>10</Text>
          </View>
          <View style={s.markerCol}>
            <Image source={rarity50} style={s.markerSm} resizeMode="contain" />
            <Text style={[s.caption, { color: theme.textMuted }]}>50</Text>
          </View>
          <View style={s.markerCol}>
            <Image source={rarity100} style={s.markerSm} resizeMode="contain" />
            <Text style={[s.caption, { color: theme.textMuted }]}>100</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  half: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  modeLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  markerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  markerCol: {
    alignItems: 'center',
    gap: 3,
  },
  marker: {
    width: 36,
    height: 50,
  },
  markerSm: {
    width: 28,
    height: 39,
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
  },
  vDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
});

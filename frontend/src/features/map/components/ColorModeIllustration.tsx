import { View, Image, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Fonts, FontSize, BorderRadius, Spacing } from '@/constants/theme';

const flashUncap = require('../../../../assets/images/marker-50pts-flash-uncaptured.png');
const flashCap   = require('../../../../assets/images/marker-50pts-flash-captured.png');
const rarity10   = require('../../../../assets/images/marker-10pts-rarity.png');
const rarity20   = require('../../../../assets/images/marker-20pts-rarity.png');
const rarity30   = require('../../../../assets/images/marker-30pts-rarity.png');
const rarity40   = require('../../../../assets/images/marker-40pts-rarity.png');
const rarity50   = require('../../../../assets/images/marker-50pts-rarity.png');
const rarity100  = require('../../../../assets/images/marker-100pts-rarity.png');

export function ColorModeIllustration() {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[s.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <Text style={[s.modeLabel, { color: theme.accent }]}>Flash</Text>
      <View style={s.markerRow}>
        <Image source={flashUncap} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>{t('tutorial.colorMode.labelUnflashed')}</Text>
      </View>
      <View style={s.markerRow}>
        <Image source={flashCap} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>{t('tutorial.colorMode.labelFlashed')}</Text>
      </View>

      <View style={[s.hDivider, { backgroundColor: theme.border }]} />

      <Text style={[s.modeLabel, { color: theme.accent }]}>{t('invaders.colorRarity')}</Text>
      <View style={s.markerRow}>
        <Image source={rarity10} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>10 pts</Text>
      </View>
      <View style={s.markerRow}>
        <Image source={rarity20} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>20 pts</Text>
      </View>
      <View style={s.markerRow}>
        <Image source={rarity30} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>30 pts</Text>
      </View>
      <View style={s.markerRow}>
        <Image source={rarity40} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>40 pts</Text>
      </View>
      <View style={s.markerRow}>
        <Image source={rarity50} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>50 pts</Text>
      </View>
      <View style={s.markerRow}>
        <Image source={rarity100} style={s.marker} resizeMode="contain" />
        <Text style={[s.caption, { color: theme.text }]}>100 pts</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: 6,
  },
  modeLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  marker: {
    width: 28,
    height: 39,
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
  },
  hDivider: {
    height: 1,
    marginVertical: 4,
  },
});

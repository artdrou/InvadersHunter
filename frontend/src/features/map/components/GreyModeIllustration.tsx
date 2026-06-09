import { View, Image, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Fonts, FontSize, BorderRadius, Spacing } from '@/constants/theme';

const markerGrey = require('../../../../assets/images/marker-50pts-grey.png');
const markerUncap = require('../../../../assets/images/marker-50pts-flash-uncaptured.png');
const markerCap   = require('../../../../assets/images/marker-50pts-flash-captured.png');

export function GreyModeIllustration() {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[s.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      {/* All — every non-flashable marker is grey */}
      <View style={s.col}>
        <Text style={[s.colLabel, { color: theme.textMuted }]}>{t('invaders.greyAll')}</Text>
        <View style={s.pair}>
          <Image source={markerGrey} style={s.marker} resizeMode="contain" />
          <Image source={markerGrey} style={s.marker} resizeMode="contain" />
        </View>
        <Text style={[s.sub, { color: theme.textMuted }]}>{t('tutorial.greyMode.subAll')}</Text>
      </View>

      <View style={[s.vDivider, { backgroundColor: theme.border }]} />

      {/* Flashed — only uncaptured non-flashable are grey; captured stay colored */}
      <View style={s.col}>
        <Text style={[s.colLabel, { color: theme.textMuted }]}>{t('invaders.greyFlashed')}</Text>
        <View style={s.pair}>
          <Image source={markerGrey} style={s.marker} resizeMode="contain" />
          <Image source={markerCap} style={s.marker} resizeMode="contain" />
        </View>
        <Text style={[s.sub, { color: theme.textMuted }]}>{t('tutorial.greyMode.subFlashed')}</Text>
      </View>

      <View style={[s.vDivider, { backgroundColor: theme.border }]} />

      {/* Off — nothing greyed */}
      <View style={s.col}>
        <Text style={[s.colLabel, { color: theme.textMuted }]}>{t('invaders.greyOff')}</Text>
        <View style={s.pair}>
          <Image source={markerUncap} style={s.marker} resizeMode="contain" />
          <Image source={markerCap} style={s.marker} resizeMode="contain" />
        </View>
        <Text style={[s.sub, { color: theme.textMuted }]}>{t('tutorial.greyMode.subOff')}</Text>
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
  col: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: 4,
    gap: 4,
  },
  colLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pair: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
  },
  marker: {
    width: 28,
    height: 39,
  },
  sub: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12,
  },
  vDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
});

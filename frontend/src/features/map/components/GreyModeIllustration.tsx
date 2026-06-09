import { View, Image, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Fonts, FontSize, BorderRadius, Spacing } from '@/constants/theme';

const markerGrey  = require('../../../../assets/images/marker-50pts-grey.png');
const markerUncap = require('../../../../assets/images/marker-50pts-flash-uncaptured.png');
const markerCap   = require('../../../../assets/images/marker-50pts-flash-captured.png');

export function GreyModeIllustration() {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[s.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      {/* All — every non-flashable is grey */}
      <View style={s.row}>
        <View style={s.markerPair}>
          <Image source={markerGrey} style={s.marker} resizeMode="contain" />
          <Image source={markerGrey} style={s.marker} resizeMode="contain" />
        </View>
        <View style={s.textBlock}>
          <Text style={[s.rowLabel, { color: theme.text }]}>{t('invaders.greyAll')}</Text>
          <Text style={[s.rowSub, { color: theme.textMuted }]}>{t('tutorial.greyMode.subAll')}</Text>
        </View>
      </View>

      <View style={[s.hDivider, { backgroundColor: theme.border }]} />

      {/* Flashed — uncaptured greyed, captured stays colored */}
      <View style={s.row}>
        <View style={s.markerPair}>
          <Image source={markerGrey} style={s.marker} resizeMode="contain" />
          <Image source={markerCap} style={s.marker} resizeMode="contain" />
        </View>
        <View style={s.textBlock}>
          <Text style={[s.rowLabel, { color: theme.text }]}>{t('invaders.greyFlashed')}</Text>
          <Text style={[s.rowSub, { color: theme.textMuted }]}>{t('tutorial.greyMode.subFlashed')}</Text>
        </View>
      </View>

      <View style={[s.hDivider, { backgroundColor: theme.border }]} />

      {/* Off — nothing greyed */}
      <View style={s.row}>
        <View style={s.markerPair}>
          <Image source={markerUncap} style={s.marker} resizeMode="contain" />
          <Image source={markerCap} style={s.marker} resizeMode="contain" />
        </View>
        <View style={s.textBlock}>
          <Text style={[s.rowLabel, { color: theme.text }]}>{t('invaders.greyOff')}</Text>
          <Text style={[s.rowSub, { color: theme.textMuted }]}>{t('tutorial.greyMode.subOff')}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.one,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  markerPair: {
    flexDirection: 'row',
    gap: 4,
    width: 64,
    alignItems: 'flex-end',
  },
  marker: {
    width: 28,
    height: 39,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  rowSub: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    lineHeight: 14,
  },
  hDivider: {
    height: 1,
  },
});

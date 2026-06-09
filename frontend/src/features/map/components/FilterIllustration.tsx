import { View, Image, Text, StyleSheet, ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, Fonts, FontSize, BorderRadius, Spacing } from '@/constants/theme';

const m50uncap  = require('../../../../assets/images/marker-50pts-flash-uncaptured.png');
const m50cap    = require('../../../../assets/images/marker-50pts-flash-captured.png');
const m50grey   = require('../../../../assets/images/marker-50pts-grey.png');
const m10uncap  = require('../../../../assets/images/marker-10pts-flash-uncaptured.png');
const m50uncap2 = require('../../../../assets/images/marker-50pts-flash-uncaptured.png');
const m100uncap = require('../../../../assets/images/marker-100pts-flash-uncaptured.png');

type MarkerEntry = { src: ImageSourcePropType; opacity: number };

function FilterRow({ label, markers, theme }: { label: string; markers: MarkerEntry[]; theme: ThemeTokens }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={s.markerGroup}>
        {markers.map((m, i) => (
          <Image key={i} source={m.src} style={[s.marker, { opacity: m.opacity }]} resizeMode="contain" />
        ))}
      </View>
    </View>
  );
}

export function FilterIllustration() {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[s.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <FilterRow
        label={t('invaders.statusUnflashed')}
        markers={[
          { src: m50uncap,  opacity: 1    },
          { src: m50cap,    opacity: 0.15 },
          { src: m50grey,   opacity: 0.15 },
        ]}
        theme={theme}
      />
      <View style={[s.hDivider, { backgroundColor: theme.border }]} />
      <FilterRow
        label={t('invaders.statusFlashed')}
        markers={[
          { src: m50uncap,  opacity: 0.15 },
          { src: m50cap,    opacity: 1    },
          { src: m50grey,   opacity: 0.15 },
        ]}
        theme={theme}
      />
      <View style={[s.hDivider, { backgroundColor: theme.border }]} />
      <FilterRow
        label={t('invaders.condFlashable')}
        markers={[
          { src: m50uncap,  opacity: 1    },
          { src: m50cap,    opacity: 1    },
          { src: m50grey,   opacity: 0.15 },
        ]}
        theme={theme}
      />
      <View style={[s.hDivider, { backgroundColor: theme.border }]} />
      <FilterRow
        label="50 pts"
        markers={[
          { src: m10uncap,  opacity: 0.15 },
          { src: m50uncap2, opacity: 1    },
          { src: m100uncap, opacity: 0.15 },
        ]}
        theme={theme}
      />
      <View style={[s.hDivider, { backgroundColor: theme.border }]} />
      <FilterRow
        label={`${t('invaders.statusUnflashed')} + 50 pts`}
        markers={[
          { src: m10uncap,  opacity: 0.15 },
          { src: m50uncap2, opacity: 1    },
          { src: m50cap,    opacity: 0.15 },
          { src: m100uncap, opacity: 0.15 },
        ]}
        theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    gap: Spacing.two,
  },
  rowLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  markerGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  marker: {
    width: 18,
    height: 25,
  },
  hDivider: {
    height: 1,
  },
});

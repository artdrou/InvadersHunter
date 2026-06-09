import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import type { ThemeTokens } from '@/constants/theme';
import { BorderRadius, Spacing, ButtonFont, ButtonFontSize } from '@/constants/theme';

type Props = {
  highlight?: number[];
};

export function RoutingPanelPreview({ highlight }: Props) {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const opOf = (zone: number) =>
    !highlight || highlight.includes(zone) ? 1 : 0.2;

  const badgeBg = (zone: number) =>
    !highlight || highlight.includes(zone) ? theme.accent : theme.border;

  const badgeFg = (zone: number) =>
    !highlight || highlight.includes(zone) ? theme.bg : theme.textMuted;

  function Badge({ zone }: { zone: number }) {
    return (
      <View style={[s.badge, { backgroundColor: badgeBg(zone) }]}>
        <Text style={[s.badgeNum, { color: badgeFg(zone) }]}>{zone}</Text>
      </View>
    );
  }

  return (
    <View style={[s.panel, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>

      {/* ① Title bar */}
      <View style={[s.titleRow, { borderBottomColor: theme.bgDivider, opacity: opOf(1) }]}>
        <Badge zone={1} />
        <Text style={[s.titleText, { color: theme.accent }]}>HUNT</Text>
        <View style={{ flex: 1 }} />
        <View style={[s.infoBtn, { borderColor: theme.accent }]}>
          <Text style={[s.infoBtnText, { color: theme.accent }]}>i</Text>
        </View>
      </View>

      <View style={s.fields}>
        {/* ② From field */}
        <View style={[s.fieldRow, { backgroundColor: theme.bg, borderColor: theme.border, opacity: opOf(2) }]}>
          <Badge zone={2} />
          <Ionicons name="navigate" size={13} color={theme.accent} />
          <Text style={[s.fieldText, { color: theme.textMuted }]}>Origin</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="locate-outline" size={13} color={theme.border} />
        </View>

        {/* ③ Mandatory stops */}
        <View style={[s.fieldRow, { backgroundColor: theme.bg, borderColor: theme.border, opacity: opOf(3) }]}>
          <Badge zone={3} />
          <Ionicons name="flag-outline" size={13} color={theme.textMuted} />
          <Text style={[s.fieldText, { color: theme.textMuted }]}>Invader stops</Text>
        </View>

        {/* ④ To field */}
        <View style={[s.fieldRow, { backgroundColor: theme.bg, borderColor: theme.border, opacity: opOf(4) }]}>
          <Badge zone={4} />
          <Ionicons name="flag" size={13} color={theme.success} />
          <Text style={[s.fieldText, { color: theme.textMuted }]}>Destination</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="locate-outline" size={13} color={theme.border} />
        </View>

        {/* ⑤ Options row */}
        <View style={[s.optionsRow, { borderTopColor: theme.bgDivider, opacity: opOf(5) }]}>
          <Badge zone={5} />
          <View style={[s.chip, { borderColor: theme.border }]}>
            <Text style={[s.chipText, { color: theme.textMuted }]}>Loop</Text>
          </View>
          <View style={[s.chip, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
            <Text style={[s.chipText, { color: theme.bg }]}>Uncaptured</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={[s.detourText, { color: theme.textMuted }]}>+15 min</Text>
          <Ionicons name="chevron-down" size={12} color={theme.textMuted} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    panel: {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },

    badge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    badgeNum: {
      fontFamily: ButtonFont,
      fontSize: 9,
      lineHeight: 12,
    },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.two,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    titleText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.md,
      letterSpacing: 1,
    },
    infoBtn: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoBtnText: {
      fontFamily: ButtonFont,
      fontSize: 9,
      lineHeight: 12,
    },

    fields: {
      paddingHorizontal: Spacing.two,
      paddingTop: 6,
      paddingBottom: 6,
      gap: 5,
    },

    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    fieldText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xs,
      flex: 1,
    },

    optionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 7,
    },

    chip: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
    },
    chipText: {
      fontFamily: ButtonFont,
      fontSize: 8,
    },

    detourText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xs,
    },
  });
}

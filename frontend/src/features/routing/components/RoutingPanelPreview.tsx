import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { BorderRadius, Spacing, ButtonFont, ButtonFontSize } from '@/constants/theme';

type Props = {
  highlight?: number[];
  expanded?: boolean;
};

export function RoutingPanelPreview({ highlight, expanded = false }: Props) {
  const { theme } = useTheme();
  const s = styles;

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
          {!expanded && (
            <>
              <View style={[s.chip, { borderColor: theme.border }]}>
                <Text style={[s.chipText, { color: theme.textMuted }]}>Loop</Text>
              </View>
              <View style={[s.chip, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                <Text style={[s.chipText, { color: theme.bg }]}>Uncaptured</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Text style={[s.detourText, { color: theme.textMuted }]}>+15 min</Text>
            </>
          )}
          <View style={{ flex: expanded ? 1 : 0 }} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={theme.textMuted} />
        </View>

        {/* Expanded options panel */}
        {expanded && (
          <View style={[s.expandedPanel, { borderTopColor: theme.bgDivider, opacity: opOf(5) }]}>
            {/* Filter chips */}
            <View style={s.chipRow}>
              <View style={[s.chip, { borderColor: theme.border }]}>
                <Ionicons name="refresh-circle-outline" size={10} color={theme.textMuted} />
                <Text style={[s.chipText, { color: theme.textMuted }]}>Loop</Text>
              </View>
              <View style={[s.chip, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                <Text style={[s.chipText, { color: theme.bg }]}>Uncaptured</Text>
              </View>
              <View style={[s.chip, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                <Text style={[s.chipText, { color: theme.bg }]}>Flashable</Text>
              </View>
            </View>
            {/* Stepper */}
            <View style={s.stepper}>
              <View style={[s.stepBtn, { borderColor: theme.border }]}>
                <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
              </View>
              <Text style={[s.stepValue, { color: theme.text }]}>+15 min</Text>
              <View style={[s.stepBtn, { borderColor: theme.border }]}>
                <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
              </View>
            </View>
            {/* Start button */}
            <View style={[s.startBtn, { backgroundColor: theme.accent }]}>
              <Ionicons name="flag" size={11} color={theme.bg} />
              <Text style={[s.startBtnText, { color: theme.bg }]}>Start</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
      fontSize: ButtonFontSize.xxs,
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
      fontSize: ButtonFontSize.xxs,
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

    expandedPanel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 7,
      gap: 7,
    },

    chipRow: {
      flexDirection: 'row',
      gap: 5,
      flexWrap: 'wrap',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
    },
    chipText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xxs,
    },

    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    stepBtn: {
      width: 24,
      height: 24,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.md,
      lineHeight: 16,
    },
    stepValue: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xs,
      minWidth: 50,
      textAlign: 'center',
    },

    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: BorderRadius.sm,
    },
    startBtnText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xs,
    },

    detourText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xs,
    },
});

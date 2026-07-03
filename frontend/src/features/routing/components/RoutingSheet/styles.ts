import { StyleSheet } from 'react-native'
import type { ThemeTokens } from '@/constants/theme'
import { BorderRadius, Spacing, ButtonFont, ButtonFontSize, FontSize } from '@/constants/theme'

/** Shared stylesheet for the RoutingSheet and its sub-parts. */
export function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale)
  return StyleSheet.create({
    // Overlay card
    overlay: {
      position: 'absolute',
      left: 8,
      right: 8,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      overflow: 'visible',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.22,
      shadowRadius: 6,
      elevation: 8,
    },

    // Panel title
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    titleText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xl, letterSpacing: 1 },

    // Fields container
    fields: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      gap: Spacing.one,
    },

    // Coord input row
    coordBlock: { gap: 2 },
    coordRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two, paddingVertical: 10,
      gap: 8,
    },
    leadingIcon: { width: 20, alignItems: 'center' },
    coordLabel:   { flex: 1 },
    coordActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

    // Options toggle row (summary + inline action button)
    optionsRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: Spacing.two, paddingBottom: Spacing.one,
    },
    optionsToggleBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    optionsSummary: { fontFamily: font, fontSize: sz(FontSize.xs) },

    // Inline / panel action button (compute / cancel)
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: Spacing.two + 2, paddingVertical: 6,
      borderRadius: BorderRadius.sm,
    },
    actionBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xs },

    // Collapsible options
    optionsPanel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: Spacing.two,
      gap: Spacing.two,
      paddingBottom: Spacing.one,
    },

    // Chips
    filterRow: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.two, paddingVertical: 5,
      borderRadius: BorderRadius.sm, borderWidth: 1,
    },
    chipActive: { backgroundColor: t.accent, borderColor: t.accent },
    chipText:   { fontFamily: ButtonFont, fontSize: ButtonFontSize.xs },

    // Stepper
    stepper:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    stepBtn:     { width: 32, height: 32, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xl },
    stepValue:   { fontFamily: font, fontSize: sz(FontSize.md), minWidth: 72, textAlign: 'center' },

    // Mandatory stops row
    mandatoryRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two, paddingVertical: 8,
      gap: 8,
    },
    mandatoryText: { flex: 1, fontFamily: font, fontSize: sz(FontSize.xs) },

    // Result
    result: {
      borderTopWidth: 1,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      gap: 2,
    },
    resultText: { fontFamily: font, fontSize: sz(FontSize.sm) },
    resultSub:  { fontFamily: font, fontSize: sz(FontSize.xs) },
    error:      { fontFamily: font, fontSize: sz(FontSize.xs), textAlign: 'center', paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },

    // Search
    searchBox:        { borderWidth: 1, borderRadius: BorderRadius.sm, marginTop: 2, overflow: 'hidden' },
    searchResult:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: Spacing.two, paddingVertical: 9 },
    searchResultText: { flex: 1, lineHeight: 17 },

    btnPressed: { opacity: 0.7 },
  })
}

export type RoutingStyles = ReturnType<typeof makeStyles>

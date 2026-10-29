import { StyleSheet } from 'react-native'
import type { ThemeTokens } from '@/constants/theme'
import { BorderRadius, Spacing, ButtonFont, FontSize, ZIndex } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button'

/** Shared stylesheet for the RoutingSheet and its sub-parts. */
export function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale)
  return StyleSheet.create({
    // Overlay card
    overlay: {
      position: 'absolute',
      left: 8,
      right: 8,
      // Sit above the map FABs (news/locate/compass at ZIndex.map) so the open
      // Hunt panel hides them instead of letting the news button bleed on top.
      zIndex: ZIndex.control,
      // Arcade panel frame (thick border, hard shadow), as the map filter windows
      ...arcadeCard(t),
      overflow: 'visible',
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
    titleText: { flexShrink: 1 },

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
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    actionBtnText: { fontFamily: ButtonFont, fontSize: FontSize.xs },

    // Collapsible options
    optionsPanel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: Spacing.two,
      gap: Spacing.two,
      paddingBottom: Spacing.one,
    },

    // Chips (map filter look: 2px outline, selected = filled arcade button)
    filterRow: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.two, paddingVertical: 5,
      borderRadius: 4, borderWidth: 2, borderColor: t.border,
    },
    // keep the outline's footprint so chips don't shift when toggled
    chipActive: { ...arcadeButton(t), borderWidth: 2, borderColor: t.accent },
    chipText:   { fontFamily: ButtonFont, fontSize: FontSize.xs, color: t.textMuted },
    chipTextActive: arcadeButtonLabel(t),

    // Stepper (outline arcade buttons)
    stepper:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    stepBtn:     { width: 32, height: 32, borderRadius: BorderRadius.sm, ...arcadeButton(t, 'outline'), alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.xl },
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

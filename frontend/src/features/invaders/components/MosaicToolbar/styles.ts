import { StyleSheet } from "react-native";
import { BorderRadius, ButtonFont, Spacing, Overlay, FontSize } from "@/constants/theme";
import { ARCADE_SHADOW } from "@/constants/arcade-button";

// Layout is theme-independent (colors are applied inline via `theme.*` in each
// component), so the sheet can be built once at module load and shared.
export const toolbarStyles = StyleSheet.create({
    container: {
      paddingTop: Spacing.six,
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.two,
      borderBottomWidth: 1,
    },
    row1: {
      flexDirection: "row",
      gap: Spacing.one,
      alignItems: "center",
    },
    searchWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      height: 38,
      gap: Spacing.one,
    },
    searchInput: {
      flex: 1,
      height: "100%",
    },
    iconBtn: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 3,
      right: 3,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize: FontSize.xxs,
      fontFamily: ButtonFont,
      lineHeight: 15,
    },
    chipsRow: {
      paddingTop: Spacing.two,
      paddingBottom: Spacing.one,
      paddingRight: Spacing.one,   // room for the last chip's offset shadow
      gap: Spacing.one,
    },
    // Active filter chips: filled arcade buttons (colours applied inline)
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
      borderRadius: 4,
    },
    chipText: {
      fontSize: FontSize.xs,
      fontFamily: ButtonFont,
    },
    // Slider
    sliderTrackOuter: {
      flex: 1,
      height: 28,
      justifyContent: "center",
    },
    sliderTrack: {
      flexDirection: "row",
      height: 4,
      borderRadius: 2,
      overflow: "hidden",
    },
    sliderFill: {
      borderRadius: 2,
    },
    sliderThumb: {
      position: "absolute",
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      marginLeft: -9, // center on position
      top: 5,
    },
    // Modal
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Overlay.scrimSoft,
    },
    // Arcade panel frame (border colour inline): thick border, small radius
    sheet: {
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      borderWidth: 2,
      borderBottomWidth: 0,
    },
    handleRow: {
      alignItems: "center",
      paddingVertical: Spacing.two,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.two,
      paddingBottom: Spacing.two,
      borderBottomWidth: 1,
    },
    headerSide: {
      width: 40,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetTitleWrap: {
      flex: 1,
      alignItems: "center",
    },
    sheetTitle: {
      textAlign: "center",
      fontSize: FontSize.lg,
      letterSpacing: 1,
    },
    panelArea: {
      // height is animated inline (MAIN_MENU_HEIGHT for the menu, taller for sub-sheets)
      overflow: "hidden",
    },
    panel: {
      width: "100%",
      height: "100%",
    },
    panelAbsolute: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.three,
      height: 56,
      borderBottomWidth: 1,
    },
    menuRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
    menuRowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.one,
      maxWidth: "50%",
    },
    menuLabel: {
      fontSize: FontSize.lg,
      fontFamily: ButtonFont,
    },
    menuValue: {
      fontSize: FontSize.md,
      fontFamily: ButtonFont,
      flexShrink: 1,
    },
    // Filter sub-sheet — categories side-by-side in columns; the selected option is a filled arcade button
    filterColumns: {
      flexDirection: "row",
      paddingHorizontal: Spacing.two,
      paddingTop: 8,
      gap: Spacing.one,
    },
    filterColumn: {
      flex: 1,
      gap: 4,
    },
    // Colour / font from arcadeSectionLabel, applied inline
    columnLabel: {
      fontSize: FontSize.sm,
      paddingHorizontal: 6,
    },
    colOption: {
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 4,
      marginRight: ARCADE_SHADOW,   // room for the selected option's offset shadow
    },
    // Sort / group options: the selected one is a filled arcade button
    optionList: {
      paddingVertical: 4,
      gap: 4,
    },
    option: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 12,
      marginLeft: Spacing.two,
      marginRight: Spacing.two + ARCADE_SHADOW,
      borderRadius: 4,
    },
    optionPressed: { opacity: 0.7 },
    optionText: {
      fontSize: FontSize.lg,
      fontFamily: ButtonFont,
    },
    sortOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    // Colour / font from arcadeSectionLabel, applied inline
    sectionLabel: {
      paddingHorizontal: Spacing.three,
      paddingTop: 10,
      paddingBottom: 4,
    },
    sectionLabelSize: { fontSize: FontSize.md },
    // Sheet bottom: view toggle + grid slider
    sheetBottom: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
    },
    sheetBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.three,
      marginTop: Spacing.one,
    },
    // Arcade segmented: accent-framed, neighbours share one border, shadow on the group
    segmented: {
      flexDirection: "row",
      borderRadius: 4,
    },
    segBtn: {
      width: 52,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    segFirst: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
    segLast: { borderTopRightRadius: 4, borderBottomRightRadius: 4, marginLeft: -2 },
    sheetSliderWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
});

/** Styles for the whole MosaicToolbar tree. Passed to every sub-component. */
export type ToolbarStyles = typeof toolbarStyles;

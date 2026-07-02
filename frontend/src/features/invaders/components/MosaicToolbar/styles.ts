import { StyleSheet } from "react-native";
import { BorderRadius, ButtonFont, ButtonFontSize, Spacing, Overlay } from "@/constants/theme";

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
      fontSize: ButtonFontSize.xxs,
      fontFamily: ButtonFont,
      lineHeight: 15,
    },
    chipsRow: {
      paddingTop: Spacing.two,
      paddingBottom: Spacing.one,
      gap: Spacing.one,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
    },
    chipText: {
      fontSize: ButtonFontSize.xs,
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
    sheet: {
      borderTopLeftRadius: BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
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
    sheetTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: ButtonFontSize.lg,
      fontFamily: ButtonFont,
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
      fontSize: ButtonFontSize.lg,
      fontFamily: ButtonFont,
    },
    menuValue: {
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
      flexShrink: 1,
    },
    // Filter sub-sheet — categories side-by-side in columns (text options, not buttons)
    filterColumns: {
      flexDirection: "row",
      paddingHorizontal: Spacing.two,
      paddingTop: 8,
      gap: Spacing.one,
    },
    filterColumn: {
      flex: 1,
    },
    columnLabel: {
      fontSize: ButtonFontSize.sm,
      fontFamily: ButtonFont,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 4,
      paddingHorizontal: 6,
    },
    colOption: {
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: BorderRadius.sm,
    },
    option: {
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
    },
    optionPressed: { opacity: 0.7 },
    optionText: {
      fontSize: ButtonFontSize.lg,
      fontFamily: ButtonFont,
    },
    sortOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionLabel: {
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
      paddingHorizontal: Spacing.three,
      paddingTop: 10,
      paddingBottom: 4,
    },
    divider: { height: 1, marginVertical: 4 },
    pointsGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: Spacing.three,
      paddingBottom: 10,
      gap: 6,
    },
    pointChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
    },
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
    segmented: {
      flexDirection: "row",
      gap: Spacing.one,
    },
    segBtn: {
      width: 52,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
    },
    sheetSliderWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
});

/** Styles for the whole MosaicToolbar tree. Passed to every sub-component. */
export type ToolbarStyles = typeof toolbarStyles;

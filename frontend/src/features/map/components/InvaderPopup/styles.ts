import { StyleSheet } from "react-native";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontBold } from "@/constants/theme";
import { arcadeButton, arcadeButtonLabel, arcadeFlashed, flashedColors } from "@/constants/arcade-button";

/** Fixed popup card width (px). */
export const POPUP_WIDTH = 300;
/** Room for the invader name in the header: card padding and the close button taken out. */
export const POPUP_NAME_WIDTH = POPUP_WIDTH - 2 * Spacing.four - 32;

export function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    scrollHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.bgDivider,
      alignSelf: "center",
    },
    container: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.lg,
      padding: Spacing.four,
      width: POPUP_WIDTH,
      gap: 14,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    name: {
      color: t.accent,
      fontSize: sz(FontSize.xl),
      fontFamily: font,
      letterSpacing: 1,
      flexShrink: 1,
    },
    titleName: {
      flexShrink: 1,
    },
    closeBtn: {
      padding: Spacing.one,
    },
    closeText: {
      color: t.textMuted,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    divider: {
      height: 1,
      backgroundColor: t.bgDivider,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: {
      color: t.textMuted,
      fontSize: sz(FontSize.lg),
      fontFamily: font,
    },
    pendingTag: {
      color: t.textMuted,
      fontSize: sz(FontSize.xxs),
      fontFamily: font,
    },
    valueWithChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    value: {
      color: t.text,
      fontSize: sz(FontSize.lg),
      fontFamily: font,
    },
    image: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: BorderRadius.sm,
    },
    flashedDate: {
      color: flashedColors(t).ink,
    },
    flashBtn: {
      borderRadius: BorderRadius.sm,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: Spacing.one,
    },
    doFlashBtn: {
      ...arcadeButton(t),
    },
    validateBtnDisabled: {
      backgroundColor: t.bgDivider,
      boxShadow: 'none',
      opacity: 0.6,
    },
    flashedState: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      ...arcadeFlashed(t),
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.three,
      marginTop: Spacing.one,
    },
    flashedStateText: {
      fontFamily: ButtonFontBold,
      fontSize: FontSize.xl,
      color: flashedColors(t).ink,
    },
    unflashLink: {
      paddingVertical: 2,
      paddingHorizontal: Spacing.one,
    },
    unflashLinkText: {
      fontFamily: ButtonFontBold,
      fontSize: FontSize.sm,
      color: flashedColors(t).ink,
      opacity: 0.8,
    },
    btnPressed: {
      opacity: 0.7,
    },
    flashBtnText: {
      ...arcadeButtonLabel(t),
      fontSize: FontSize.xl,
    },
    linksRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.four,
      paddingVertical: Spacing.one,
    },
    linkIconBtn: {
      padding: Spacing.one,
    },
    // Slightly tighter than the popup's own 14px gap, for the info rows.
    infoBlock: { gap: 10 },
    topCommentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.one,
    },
    topCommentIcon: {
      marginTop: 2,
    },
    topCommentText: {
      flex: 1,
      color: t.text,
      fontSize: sz(FontSize.md),
      fontFamily: font,
      fontStyle: "italic",
    },
    // Discovered-by / updated-by on their own lines, same interligne as infoBlock.
    contributorsBlock: { gap: 10 },
    contributorText: {
      color: t.textMuted,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
      textAlign: "center",
    },
    contributorName: {
      color: t.accent,
      fontFamily: font,
    },
    modifyLink: {
      alignItems: "center",
      paddingVertical: Spacing.one,
    },
    modifyLinkText: {
      color: t.accent,
      fontSize: FontSize.md,
      fontFamily: ButtonFont,
    },
    form: {
      // maxHeight is applied inline from the window height so the photo field
      // never gets clipped out of reach on tall content / large font scales.
    },
    formContent: {
      paddingBottom: Spacing.two,
    },
    fieldLabel: {
      color: t.textMuted,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
      marginBottom: 4,
      marginTop: Spacing.two,
    },
    positionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: Spacing.two,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.two,
    },
    positionValue: {
      color: t.text,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
      flexShrink: 1,
    },
    positionEdit: {
      color: t.accent,
      fontSize: FontSize.md,
      fontFamily: ButtonFont,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 8,
    },
    cancelBtnText: {
      color: t.textMuted,
      fontSize: FontSize.xl,
      fontFamily: ButtonFont,
    },
    offlineMsg: {
      color: t.danger,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
      textAlign: "center",
    },
    arrow: {
      alignSelf: "center",
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 10,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: t.border,
    },
  });
}

export type PopupStyles = ReturnType<typeof makeStyles>;

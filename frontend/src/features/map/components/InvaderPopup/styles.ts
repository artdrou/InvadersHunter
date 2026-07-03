import { StyleSheet } from "react-native";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontSize } from "@/constants/theme";

/** Fixed popup card width (px). */
export const POPUP_WIDTH = 300;

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
      color: t.success,
    },
    flashBtn: {
      borderRadius: BorderRadius.sm,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: Spacing.one,
    },
    doFlashBtn: {
      backgroundColor: t.accent,
    },
    validateBtnDisabled: {
      backgroundColor: t.bgDivider,
      opacity: 0.6,
    },
    unflashBtn: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.danger,
    },
    btnPressed: {
      opacity: 0.7,
    },
    flashBtnText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xl,
      color: t.bg,
    },
    unflashBtnText: {
      color: t.danger,
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
    modifyLink: {
      alignItems: "center",
      paddingVertical: Spacing.one,
    },
    modifyLinkText: {
      color: t.accent,
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
    },
    modifyLinkDisabledText: {
      color: t.textMuted,
      opacity: 0.6,
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
    stateGrid: {
      gap: 5,
    },
    stateRow: {
      flexDirection: "row",
      gap: 5,
    },
    stateOptionHalf: {
      flex: 1,
    },
    stateOption: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 8,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
    },
    stateOptionSelected: {
      borderColor: t.accent,
      backgroundColor: t.bg,
    },
    stateOptionText: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    stateOptionTextSelected: {
      color: t.accent,
      fontFamily: font,
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
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 8,
    },
    cancelBtnText: {
      color: t.textMuted,
      fontSize: ButtonFontSize.xl,
      fontFamily: ButtonFont,
    },
    offlineMsg: {
      color: t.danger,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
      textAlign: "center",
    },
    imagePreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: Spacing.two,
    },
    imageThumb: {
      width: 64,
      height: 64,
      borderRadius: BorderRadius.sm,
    },
    removePhotoBtn: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
    },
    removePhotoBtnText: {
      color: t.textMuted,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
    },
    addPhotoBtn: {
      paddingVertical: 10,
      paddingHorizontal: Spacing.two,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      alignItems: "center",
      marginBottom: Spacing.two,
    },
    addPhotoBtnText: {
      color: t.accent,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
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

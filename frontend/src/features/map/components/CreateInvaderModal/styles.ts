import { StyleSheet } from "react-native";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontBold } from "@/constants/theme";
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';

/** Fixed create-modal card width (px). */
export const CARD_WIDTH = 300;

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
      ...arcadeCard(t),
      padding: Spacing.four,
      width: CARD_WIDTH,
      gap: 10,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      color: t.accent,
      fontSize: sz(FontSize.lg),
      fontFamily: ButtonFontBold,
      letterSpacing: 1,
    },
    closeBtn: {
      padding: Spacing.one,
    },
    closeText: {
      color: t.textMuted,
      fontSize: FontSize.md,
      fontFamily: font,
    },
    divider: {
      height: 1,
      backgroundColor: t.bgDivider,
    },
    form: {},
    fieldLabel: {
      color: t.textMuted,
      fontSize: sz(12),
      fontFamily: font,
      marginBottom: 4,
      marginTop: Spacing.one,
    },
    input: {
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      color: t.text,
      paddingHorizontal: Spacing.two,
      paddingVertical: 8,
      fontSize: sz(14),
      fontFamily: font,
    },
    inputError: {
      borderColor: t.danger,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    nameRowError: {},
    nameCity: {
      width: 58,
      textTransform: "uppercase",
    },
    nameSep: {
      color: t.textMuted,
      fontSize: sz(18),
      fontFamily: font,
    },
    nameNum: {
      width: 64,
    },
    namePreview: {
      color: t.textMuted,
      fontSize: sz(13),
      fontFamily: font,
      flexShrink: 1,
    },
    errorMsg: {
      color: t.danger,
      fontSize: sz(11),
      fontFamily: font,
      marginTop: 2,
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
    },
    positionValue: {
      color: t.text,
      fontSize: sz(12),
      fontFamily: font,
      flexShrink: 1,
    },
    positionEdit: {
      color: t.accent,
      fontSize: FontSize.md,
      fontFamily: ButtonFont,
    },
    submitBtn: {
      ...arcadeButton(t),
      borderRadius: BorderRadius.sm,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: Spacing.one,
    },
    submitBtnDisabled: {
      backgroundColor: t.bgDivider,
      boxShadow: 'none',
      opacity: 0.6,
    },
    btnPressed: {
      opacity: 0.7,
    },
    submitBtnText: {
      ...arcadeButtonLabel(t),
      fontSize: FontSize.xxl,
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
      fontSize: sz(12),
      fontFamily: font,
      textAlign: "center",
    },
  });
}

export type CreateStyles = ReturnType<typeof makeStyles>;

import { TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, BorderRadius, Spacing } from "@/constants/theme";

type Props = {
  value: string;
  onChange: (year: string) => void;
};

/** Year-of-installation input (digits only, 4 max) shared by the invader create and edit forms. */
export function YearInput({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  return (
    <TextInput
      style={styles.input}
      placeholder={t("popup.yearPlaceholder")}
      placeholderTextColor={theme.textMuted}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, ""))}
      keyboardType="numeric"
      maxLength={4}
    />
  );
}

/** "2015" -> "2015-01-01" (the API stores the year as a date); null unless 4 digits. */
export function yearToDatePose(year: string): string | null {
  return year.length === 4 ? `${year}-01-01` : null;
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    input: {
      width: 90,
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
  });
}

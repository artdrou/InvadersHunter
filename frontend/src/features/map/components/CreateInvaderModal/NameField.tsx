import { View, Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import type { ThemeTokens } from "@/constants/theme";
import type { CreateStyles } from "./styles";

type Props = {
  city: string;
  num: string;
  proposedName: string;
  error: boolean;
  onCityChange: (v: string) => void;
  onNumChange: (v: string) => void;
  theme: ThemeTokens;
  styles: CreateStyles;
};

/** The "CITY_NUM" name entry: two inputs, a live preview, and an error line. */
export function NameField({ city, num, proposedName, error, onCityChange, onNumChange, theme, styles }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={styles.fieldLabel}>{t('popup.name')}</Text>
      <View style={[styles.nameRow, error && styles.nameRowError]}>
        <TextInput
          style={[styles.input, styles.nameCity, error && styles.inputError]}
          placeholder="PA"
          placeholderTextColor={theme.textMuted}
          value={city}
          onChangeText={onCityChange}
          autoCapitalize="characters"
          maxLength={4}
        />
        <Text style={styles.nameSep}>_</Text>
        <TextInput
          style={[styles.input, styles.nameNum, error && styles.inputError]}
          placeholder="001"
          placeholderTextColor={theme.textMuted}
          value={num}
          onChangeText={(v) => onNumChange(v.replace(/\D/g, ""))}
          keyboardType="numeric"
          maxLength={4}
        />
        {proposedName.length > 0 && (
          <Text style={styles.namePreview}>{proposedName}</Text>
        )}
      </View>
      {error && <Text style={styles.errorMsg}>{t('popup.nameError')}</Text>}
    </>
  );
}

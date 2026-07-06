import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from "@/constants/theme";

type Props = {
  imageUri: string | null;
  onChange: (uri: string | null) => void;
};

/**
 * Optional photo field for the invader edit/create forms: prompts for
 * camera/gallery, previews the picked image, and clears it. Self-contained so
 * both forms share one implementation (and the picker logic lives in one place).
 */
export function PhotoField({ imageUri, onChange }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  async function pickImage(source: "camera" | "library") {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  function handleAddPhoto() {
    Alert.alert(t("popup.addPhotoTitle"), undefined, [
      { text: t("popup.camera"), onPress: () => pickImage("camera") },
      { text: t("popup.gallery"), onPress: () => pickImage("library") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  if (imageUri) {
    return (
      <View style={styles.previewRow}>
        <Image source={imageUri} style={styles.thumb} contentFit="cover" />
        <Pressable
          onPress={() => onChange(null)}
          style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
        >
          <Text style={styles.removeText}>{t("popup.removePhoto")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
      onPress={handleAddPhoto}
    >
      <Text style={styles.addText}>{t("popup.addPhoto")}</Text>
    </Pressable>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    thumb: {
      width: 64,
      height: 64,
      borderRadius: BorderRadius.sm,
    },
    removeBtn: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
    },
    removeText: {
      color: t.textMuted,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
    },
    addBtn: {
      paddingVertical: 10,
      paddingHorizontal: Spacing.two,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      alignItems: "center",
    },
    addText: {
      color: t.accent,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}

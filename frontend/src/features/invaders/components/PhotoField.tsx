import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from "@/constants/theme";
import { arcadeButton, arcadeButtonLabel } from "@/constants/arcade-button";
import { ShadowText } from "@/components/ShadowText";

type Props = {
  imageUri: string | null;
  onChange: (uri: string | null) => void;
};

/**
 * Optional photo field for the invader edit/create forms: prompts for
 * camera/gallery, previews the picked image, and clears it. Self-contained so
 * both forms share one implementation (and the picker logic lives in one place).
 */
/** Returns a function that asks camera / gallery, then calls `onPicked` with the photo. */
export function usePhotoPrompt(onPicked: (uri: string) => void): () => void {
  const { t } = useTranslation();

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
    if (!result.canceled) onPicked(result.assets[0].uri);
  }

  return () => {
    Alert.alert(t("popup.addPhotoTitle"), undefined, [
      { text: t("popup.camera"), onPress: () => pickImage("camera") },
      { text: t("popup.gallery"), onPress: () => pickImage("library") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };
}

export function PhotoField({ imageUri, onChange }: Props) {
  const { t } = useTranslation();
  const { theme, fontScale } = useTheme();
  const styles = makeStyles(theme, fontScale);
  const handleAddPhoto = usePhotoPrompt(onChange);

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
      <ShadowText shadowColor={theme.titleShadow} style={styles.addText}>{t("popup.addPhoto")}</ShadowText>
    </Pressable>
  );
}

// Arcade buttons: "Add photo" outline, "Remove" danger (destructive, always an outline)
function makeStyles(t: ThemeTokens, scale: number) {
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
      paddingVertical: 5,
      borderRadius: BorderRadius.sm,
      ...arcadeButton(t, "danger"),
    },
    removeText: {
      ...arcadeButtonLabel(t, "danger"),
      fontSize: sz(FontSize.xs),
    },
    addBtn: {
      paddingVertical: 9,
      paddingHorizontal: Spacing.two,
      borderRadius: BorderRadius.sm,
      alignItems: "center",
      ...arcadeButton(t, "outline"),
    },
    addText: {
      ...arcadeButtonLabel(t, "outline"),
      fontSize: sz(FontSize.xs),
    },
    pressed: {
      opacity: 0.7,
    },
  });
}

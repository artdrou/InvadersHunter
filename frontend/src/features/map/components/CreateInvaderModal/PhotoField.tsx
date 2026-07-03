import { View, Text, Pressable, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import type { CreateStyles } from "./styles";

type Props = {
  imageUri: string | null;
  onChange: (uri: string | null) => void;
  styles: CreateStyles;
};

/** Optional photo picker: camera/gallery prompt, thumbnail preview, remove. */
export function PhotoField({ imageUri, onChange, styles }: Props) {
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
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  function handleAddPhoto() {
    Alert.alert(t('popup.addPhotoTitle'), undefined, [
      { text: t('popup.camera'), onPress: () => pickImage("camera") },
      { text: t('popup.gallery'), onPress: () => pickImage("library") },
      { text: t('common.cancel'), style: "cancel" },
    ]);
  }

  if (imageUri) {
    return (
      <View style={styles.imagePreviewRow}>
        <Image source={{ uri: imageUri }} style={styles.imageThumb} />
        <Pressable
          onPress={() => onChange(null)}
          style={({ pressed }) => [styles.removePhotoBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.removePhotoBtnText}>{t('popup.removePhoto')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.btnPressed]}
      onPress={handleAddPhoto}
    >
      <Text style={styles.addPhotoBtnText}>{t('popup.addPhoto')}</Text>
    </Pressable>
  );
}

import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Spacing } from "@/constants/theme";
import type { InvaderWithState } from "@/features/invaders";
import type { ModifyRequestPayload } from "@/features/invaders/services/invaders.api";
import { uploadRequestPhoto } from "@/features/invaders/services/invaders.api";
import type { UserRequest } from "@/features/invaders/types";
import { STATE_OPTIONS, STATE_KEYS } from "@/features/invaders/state-options";
import type { PopupStyles } from "./styles";

// Cap the scrollable form so its last field (the photo picker) stays reachable:
// window height minus the fixed popup chrome (header, dividers, buttons, arrow).
const FORM_MIN_HEIGHT = 220;
const POPUP_CHROME_HEIGHT = 280;

type Props = {
  invader: InvaderWithState;
  pendingCoords?: { lat: number; lon: number } | null;
  onClose: () => void;
  onPickLocation?: (invader: InvaderWithState) => void;
  onRequestSent?: () => void;
  onSubmitModifyRequest: (payload: ModifyRequestPayload) => Promise<UserRequest | null>;
  styles: PopupStyles;
};

/** Edit form: propose a new condition, position, and/or photo for an invader. */
export function PopupEdit({ invader, pendingCoords, onClose, onPickLocation, onRequestSent, onSubmitModifyRequest, styles }: Props) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const formMaxHeight = Math.max(FORM_MIN_HEIGHT, windowHeight - POPUP_CHROME_HEIGHT);

  const [submitting, setSubmitting] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [invaderState, setInvaderState] = useState<string>(invader.state ?? "");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const isUnchanged = invaderState === (invader.state ?? "") && !pendingCoords && !imageUri;

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
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function handleAddPhoto() {
    Alert.alert(t('popup.addPhotoTitle'), undefined, [
      { text: t('popup.camera'),  onPress: () => pickImage("camera") },
      { text: t('popup.gallery'), onPress: () => pickImage("library") },
      { text: t('common.cancel'), style: "cancel" },
    ]);
  }

  async function handleSend() {
    setSubmitting(true);
    setOfflineError(false);
    setUploadError(false);
    try {
      const req = await onSubmitModifyRequest({
        invader_id: invader.id,
        proposed_state: invaderState || undefined,
        proposed_latitude: pendingCoords?.lat,
        proposed_longitude: pendingCoords?.lon,
      });
      if (req && imageUri) {
        try {
          await uploadRequestPhoto(req.id, imageUri);
        } catch {
          // Request submitted — just photo failed. Show error, let user close manually.
          setSubmitting(false);
          setUploadError(true);
          return;
        }
      }
      onRequestSent?.();
      onClose();
    } catch {
      // Only non-network errors reach here (offline is queued silently)
      setSubmitting(false);
      setOfflineError(true);
    }
  }

  return (
    <>
      <View style={styles.scrollHandle} />
      <View style={styles.header}>
        <Text style={styles.name}>{t('popup.updateTitle', { name: invader.name })}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <ScrollView
        style={[styles.form, { maxHeight: formMaxHeight }]}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.fieldLabel}>{t('popup.state')}</Text>
        <View style={[styles.stateGrid, { marginBottom: Spacing.two }]}>
          {[STATE_OPTIONS.slice(0, 2), STATE_OPTIONS.slice(2, 4), STATE_OPTIONS.slice(4, 6)].map((pair, ri) => (
            <View key={ri} style={styles.stateRow}>
              {pair.map((s) => {
                const selected = invaderState === s;
                return (
                  <Pressable
                    key={s}
                    style={[styles.stateOption, styles.stateOptionHalf, selected && styles.stateOptionSelected]}
                    onPress={() => setInvaderState(s)}
                  >
                    <Text style={[styles.stateOptionText, selected && styles.stateOptionTextSelected]}>
                      {t(STATE_KEYS[s])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t('popup.position')}</Text>
        <Pressable
          style={({ pressed }) => [styles.positionRow, pressed && styles.btnPressed]}
          onPress={() => onPickLocation?.(invader)}
        >
          <Text style={styles.positionValue}>
            {pendingCoords
              ? `${pendingCoords.lat.toFixed(6)}, ${pendingCoords.lon.toFixed(6)}`
              : `${invader.latitude?.toFixed(6) ?? '—'}, ${invader.longitude?.toFixed(6) ?? '—'}`}
          </Text>
          <Text style={styles.positionEdit}>{t('popup.edit')}</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>{t('popup.photoOptional')}</Text>
        {imageUri ? (
          <View style={styles.imagePreviewRow}>
            <Image source={imageUri} style={styles.imageThumb} contentFit="cover" />
            <Pressable
              onPress={() => setImageUri(null)}
              style={({ pressed }) => [styles.removePhotoBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.removePhotoBtnText}>{t('popup.removePhoto')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.btnPressed]}
            onPress={handleAddPhoto}
          >
            <Text style={styles.addPhotoBtnText}>{t('popup.addPhoto')}</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [
          styles.flashBtn,
          styles.doFlashBtn,
          (isUnchanged || submitting) && styles.validateBtnDisabled,
          (pressed && !submitting && !isUnchanged) && styles.btnPressed,
        ]}
        onPress={handleSend}
        disabled={submitting || isUnchanged}
      >
        <Text style={styles.flashBtnText}>
          {submitting ? t('popup.sending') : t('popup.validate')}
        </Text>
      </Pressable>

      {offlineError && <Text style={styles.offlineMsg}>{t('common.noInternet')}</Text>}
      {uploadError && <Text style={styles.offlineMsg}>{t('popup.photoUploadFailed')}</Text>}

      <Pressable
        style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
        onPress={() => { setOfflineError(false); onClose(); }}
      >
        <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
      </Pressable>
    </>
  );
}

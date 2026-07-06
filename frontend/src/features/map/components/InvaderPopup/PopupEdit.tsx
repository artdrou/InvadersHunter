import { useState } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { InvaderWithState } from "@/features/invaders";
import type { ModifyRequestPayload } from "@/features/invaders/services/invaders.api";
import { uploadRequestPhoto } from "@/features/invaders/services/invaders.api";
import type { UserRequest } from "@/features/invaders/types";
import { StateGrid } from "@/features/invaders/components/StateGrid";
import { PhotoField } from "@/features/invaders/components/PhotoField";
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
        <StateGrid value={invaderState} onSelect={setInvaderState} />

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
        <PhotoField imageUri={imageUri} onChange={setImageUri} />
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

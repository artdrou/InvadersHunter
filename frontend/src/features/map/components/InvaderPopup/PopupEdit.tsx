import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, useWindowDimensions } from "react-native";
import { isAxiosError } from "axios";
import { apiErrorDetail } from "@/services/api-client";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { ShadowText } from "@/components/ShadowText";
import type { InvaderWithState } from "@/features/invaders";
import type { ModifyRequestPayload } from "@/features/invaders/services/invaders.api";
import { uploadRequestPhoto } from "@/features/invaders/services/invaders.api";
import type { UserRequest } from "@/features/invaders/types";
import { StateGrid } from "@/features/invaders/components/StateGrid";
import { PhotoField, usePhotoPrompt } from "@/features/invaders/components/PhotoField";
import { PointsPicker } from "@/features/invaders/components/PointsPicker";
import { YearInput, yearToDatePose } from "@/features/invaders/components/YearInput";
import type { EditField } from "@/features/invaders/edit-fields";
import { DeleteInvaderButton } from "@/features/admin/components/DeleteInvaderButton";
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
  /** Opened from a missing detail's "+ Add": "photo" asks for the photo right away. */
  initialField?: EditField | null;
  styles: PopupStyles;
};

/** Edit form: propose a new condition, position, and/or photo for an invader. */
export function PopupEdit({ invader, pendingCoords, onClose, onPickLocation, onRequestSent, onSubmitModifyRequest, initialField, styles }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const formMaxHeight = Math.max(FORM_MIN_HEIGHT, windowHeight - POPUP_CHROME_HEIGHT);

  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState(false);
  const [invaderState, setInvaderState] = useState<string>(invader.state ?? "");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(invader.points ?? null);
  const knownYear = invader.date_pose ? invader.date_pose.slice(0, 4) : "";
  const [year, setYear] = useState(knownYear);
  const promptPhoto = usePhotoPrompt(setImageUri);

  // "+ Add" on a missing photo: straight to camera / gallery
  useEffect(() => {
    if (initialField === "photo") promptPhoto();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pointsChanged = points !== (invader.points ?? null);
  const yearChanged = year !== knownYear && yearToDatePose(year) !== null;
  const isUnchanged = invaderState === (invader.state ?? "") && !pendingCoords && !imageUri
    && !pointsChanged && !yearChanged;

  async function handleSend() {
    setSubmitting(true);
    setSendError(null);
    setUploadError(false);
    try {
      const req = await onSubmitModifyRequest({
        invader_id: invader.id,
        // Only a changed state is a proposal (one pending proposal per detail)
        proposed_state: invaderState && invaderState !== (invader.state ?? "") ? invaderState : undefined,
        proposed_latitude: pendingCoords?.lat,
        proposed_longitude: pendingCoords?.lon,
        proposed_points: pointsChanged ? points : undefined,
        proposed_date_pose: yearChanged ? yearToDatePose(year) : undefined,
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
      // null = no network: queued, sent at the next sync — say so instead of a silent success
      if (req === null) Alert.alert(t('popup.queuedTitle'), t('popup.queuedBody'));
      onRequestSent?.();
      onClose();
    } catch (e) {
      // Only server rejections reach here (no network is queued above)
      setSubmitting(false);
      setSendError(isAxiosError(e) && e.response?.status === 409
        ? t('popup.alreadyPending')
        : apiErrorDetail(e) ?? t('popup.sendFailed'));
    }
  }

  return (
    <>
      <View style={styles.scrollHandle} />
      <View style={styles.header}>
        <View style={styles.titleName}>
          <ShadowText shadowColor={theme.titleShadow} style={styles.name}>{t('popup.updateTitle', { name: invader.name })}</ShadowText>
        </View>
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

        <Text style={styles.fieldLabel}>{t('popup.points')}</Text>
        <PointsPicker value={points} onChange={setPoints} />

        <Text style={styles.fieldLabel}>{t('popup.yearOptional')}</Text>
        <YearInput value={year} onChange={setYear} />

        <Text style={styles.fieldLabel}>{t('popup.position')}</Text>
        <Pressable
          style={({ pressed }) => [styles.positionRow, pressed && styles.btnPressed]}
          onPress={() => onPickLocation?.(invader)}
        >
          <Text style={styles.positionValue}>
            {pendingCoords
              ? `${pendingCoords.lat.toFixed(6)}, ${pendingCoords.lon.toFixed(6)}`
              : invader.latitude != null && invader.longitude != null
                ? `${invader.latitude.toFixed(6)}, ${invader.longitude.toFixed(6)}`
                : t('popup.locationUnknown')}
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

      {sendError && <Text style={styles.offlineMsg}>{sendError}</Text>}
      {uploadError && <Text style={styles.offlineMsg}>{t('popup.photoUploadFailed')}</Text>}

      <Pressable
        style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
        onPress={() => { setSendError(null); onClose(); }}
      >
        <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
      </Pressable>

      {/* Admins only (renders nothing otherwise) */}
      <DeleteInvaderButton invaderId={invader.id} invaderName={invader.name} onDeleted={onClose} />
    </>
  );
}

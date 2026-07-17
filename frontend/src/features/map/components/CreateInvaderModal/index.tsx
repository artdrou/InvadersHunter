import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import type { UserRequest } from "@/features/invaders/types";
import { useInvaderStore } from "@/features/invaders/store";
import { uploadRequestPhoto, cancelRequest } from "@/features/invaders/services/invaders.api";
import type { CreateRequestPayload } from "@/features/invaders/services/invaders.api";
import type { CustomInvader, CustomInvaderDraft } from "@/features/custom-invaders/types";
import { isNetworkError } from "@/services/sync";
import { useTheme } from "@/contexts/theme-context";
import { makeStyles } from "./styles";
import { cityNumberPadding, buildProposedName } from "./name";
import { NameField } from "./NameField";
import { StateGrid } from "@/features/invaders/components/StateGrid";
import { PhotoField } from "@/features/invaders/components/PhotoField";

const POINT_OPTIONS = [10, 20, 30, 40, 50, 100] as const;

/**
 * Turns the form into a personal-invader editor instead of a community proposal:
 * it writes straight to the user's own collection (no admin review), so there's
 * no photo upload — that endpoint is tied to a request id.
 */
export type PersonalMode = {
  /** Row being edited; omit to create a new one. */
  initial?: CustomInvader | null;
  onSubmit: (draft: CustomInvaderDraft) => Promise<unknown>;
};

type Props = {
  lat: number;
  lon: number;
  onPickLocation: () => void;
  onRequestSent: () => void;
  onClose: () => void;
  onSubmitCreateRequest?: (payload: CreateRequestPayload) => Promise<UserRequest | null>;
  personal?: PersonalMode;
};

/**
 * Form to add an invader at a picked location. Two modes sharing one form:
 * by default it proposes a new *community* invader (admin review, photo upload);
 * with `personal` it creates or edits one of the user's own invaders.
 */
export function CreateInvaderModal({
  lat, lon, onPickLocation, onRequestSent, onClose, onSubmitCreateRequest, personal,
}: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const initial = personal?.initial ?? null;
  const [nameCity, setNameCity] = useState(initial?.city ?? "");
  const [nameNum, setNameNum] = useState(initial?.number != null ? String(initial.number) : "");
  const [invaderState, setInvaderState] = useState(initial?.state ?? "");
  const [points, setPoints] = useState<number | null>(initial?.points ?? null);
  const [year, setYear] = useState(initial?.date_pose?.slice(0, 4) ?? "");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [nameError, setNameError] = useState(false);

  const allInvaders = useInvaderStore((s) => s.invaders);
  const cityPadding = cityNumberPadding(nameCity, allInvaders);
  const proposedName = buildProposedName(nameCity, nameNum, cityPadding);
  const isValid = nameCity.trim().length > 0 && nameNum.trim().length > 0;
  const isPersonal = personal != null;

  const title = isPersonal
    ? (initial ? t('customInvaders.editTitle') : t('customInvaders.newTitle'))
    : t('popup.newInvader');

  async function handleSend() {
    if (!isValid) { setNameError(true); return; }
    setNameError(false);
    setSubmitting(true);
    setOfflineError(false);
    setUploadError(false);

    const datePose = year.length === 4 ? `${year}-01-01` : null;

    if (personal) {
      try {
        await personal.onSubmit({
          name: proposedName,
          city: nameCity.trim().toUpperCase() || null,
          number: nameNum ? Number(nameNum) : null,
          state: invaderState || null,
          points,
          latitude: lat,
          longitude: lon,
          date_pose: datePose,
        });
        onRequestSent();
        onClose();
      } catch {
        setSubmitting(false);
        setUploadError(true);
      }
      return;
    }

    try {
      const req = await onSubmitCreateRequest!({
        proposed_name: proposedName,
        proposed_latitude: lat,
        proposed_longitude: lon,
        proposed_state: invaderState || null,
        proposed_points: points,
        proposed_date_pose: datePose,
      });
      // req is null when queued offline — skip photo upload (no req id yet)
      if (req && imageUri) {
        try {
          await uploadRequestPhoto(req.id, imageUri);
        } catch (uploadErr) {
          await cancelRequest(req.id).catch(() => {});
          setSubmitting(false);
          if (isNetworkError(uploadErr)) setOfflineError(true);
          else setUploadError(true);
          return;
        }
      }
      onRequestSent();
      onClose();
    } catch {
      setSubmitting(false);
      setUploadError(true);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.scrollHandle} />

      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View style={styles.form}>
        <NameField
          city={nameCity}
          num={nameNum}
          proposedName={proposedName}
          error={nameError}
          onCityChange={(v) => { setNameCity(v); setNameError(false); }}
          onNumChange={(v) => { setNameNum(v); setNameError(false); }}
          theme={theme}
          styles={styles}
        />

        <Text style={styles.fieldLabel}>{t('popup.points')}</Text>
        <View style={styles.pointsRow}>
          {POINT_OPTIONS.map((p) => {
            const selected = points === p;
            return (
              <Pressable
                key={p}
                style={[styles.pointOption, selected && styles.stateOptionSelected]}
                onPress={() => setPoints(selected ? null : p)}
              >
                <Text style={[styles.pointOptionText, selected && styles.stateOptionTextSelected]}>{p}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>{t('popup.yearOptional')}</Text>
        <TextInput
          style={[styles.input, styles.yearInput]}
          placeholder={t('popup.yearPlaceholder')}
          placeholderTextColor={theme.textMuted}
          value={year}
          onChangeText={(v) => setYear(v.replace(/\D/g, ""))}
          keyboardType="numeric"
          maxLength={4}
        />

        <Text style={styles.fieldLabel}>{t('popup.state')}</Text>
        <StateGrid value={invaderState} onSelect={(s) => setInvaderState(invaderState === s ? "" : s)} />

        <Text style={styles.fieldLabel}>{t('popup.position')}</Text>
        <Pressable
          style={({ pressed }) => [styles.positionRow, pressed && styles.btnPressed]}
          onPress={onPickLocation}
        >
          <Text style={styles.positionValue}>{lat.toFixed(6)}, {lon.toFixed(6)}</Text>
          <Text style={styles.positionEdit}>{t('popup.edit')}</Text>
        </Pressable>

        {/* Personal invaders have nowhere to put a photo: the upload endpoint
            keys on an admin request id, which they never get. */}
        {!isPersonal && (
          <>
            <Text style={styles.fieldLabel}>{t('popup.photoOptional')}</Text>
            <PhotoField imageUri={imageUri} onChange={setImageUri} />
          </>
        )}
      </View>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [
          styles.submitBtn,
          (!isValid || submitting) && styles.submitBtnDisabled,
          (pressed && isValid && !submitting) && styles.btnPressed,
        ]}
        onPress={handleSend}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>
          {submitting
            ? t('popup.sending')
            : isPersonal ? t('customInvaders.save') : t('popup.submit')}
        </Text>
      </Pressable>

      {offlineError && <Text style={styles.offlineMsg}>{t('common.noInternet')}</Text>}
      {uploadError && (
        <Text style={styles.offlineMsg}>
          {isPersonal ? t('customInvaders.saveFailed') : t('popup.photoUploadFailed')}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
        onPress={onClose}
      >
        <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  );
}

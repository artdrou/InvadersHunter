import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import type { UserRequest } from "@/features/invaders/types";
import { useInvaderStore } from "@/features/invaders/store";
import { uploadRequestPhoto, cancelRequest } from "@/features/invaders/services/invaders.api";
import type { CreateRequestPayload } from "@/features/invaders/services/invaders.api";
import type { CustomInvader, CustomInvaderDraft } from "@/features/custom-invaders/types";
import { isNetworkError } from "@/services/sync";
import { useRequireAccount } from "@/features/auth";
import { useMarkerCustomizationStore } from "@/features/settings";
import { IconCarousel } from "@/features/marker-customization/components/IconCarousel";
import type { TierPts } from "@/features/marker-customization/types";
import { useTheme } from "@/contexts/theme-context";
import { makeStyles } from "./styles";
import { cityNumberPadding, buildProposedName } from "./name";
import { NameField } from "./NameField";
import { PersonalToggle } from "./PersonalToggle";
import { StateGrid } from "@/features/invaders/components/StateGrid";
import { PhotoField } from "@/features/invaders/components/PhotoField";

const POINT_OPTIONS = [10, 20, 30, 40, 50, 100] as const;

/** Silhouette a personal invader falls back to before the owner picks one. */
const DEFAULT_ICON_SHAPE: TierPts = 30;

type Props = {
  lat: number;
  lon: number;
  onPickLocation: () => void;
  /** `wasPersonal` lets the caller skip the "sent for review" toast — a personal
   *  invader is already on the map, nothing was sent anywhere. */
  onRequestSent: (wasPersonal: boolean) => void;
  onClose: () => void;
  onSubmitCreateRequest: (payload: CreateRequestPayload) => Promise<UserRequest | null>;
  /** Creates/updates a personal invader. `imageUri` is a freshly picked local
   *  file; the caller owns uploading it once the row has a server id. */
  onSubmitPersonal: (draft: CustomInvaderDraft, imageUri: string | null) => Promise<unknown>;
  /** Personal invader being edited — locks the form into personal mode. */
  editingPersonal?: CustomInvader | null;
};

/**
 * Form to add an invader at a picked location. One form, two destinations, picked
 * with the personal toggle: a *community* proposal (admin review) or one of the
 * user's own invaders (straight into their collection).
 *
 * The account gate sits on the community submit rather than on opening the form:
 * guests are allowed to create personal invaders (they stay local until the
 * account claim migrates them), they just can't propose to the community.
 */
export function CreateInvaderModal({
  lat, lon, onPickLocation, onRequestSent, onClose, onSubmitCreateRequest,
  onSubmitPersonal, editingPersonal,
}: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  const requireAccount = useRequireAccount();

  const initial = editingPersonal ?? null;
  const [isPersonal, setIsPersonal] = useState(initial != null);
  const [nameCity, setNameCity] = useState(initial?.city ?? "");
  const [nameNum, setNameNum] = useState(initial?.number != null ? String(initial.number) : "");
  const [invaderState, setInvaderState] = useState(initial?.state ?? "");
  const [points, setPoints] = useState<number | null>(initial?.points ?? null);
  const [year, setYear] = useState(initial?.date_pose?.slice(0, 4) ?? "");
  const [imageUri, setImageUri] = useState<string | null>(initial?.image_url ?? null);
  const [iconShape, setIconShape] = useState<TierPts>(initial?.icon_shape ?? DEFAULT_ICON_SHAPE);
  const [submitting, setSubmitting] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [nameError, setNameError] = useState(false);

  // Preview the carousel in the colours the marker will really use: the custom
  // palette when it's switched on, the uncaptured one otherwise (personal
  // invaders are never "captured").
  const markerColors = useMarkerCustomizationStore((s) => s.colors);
  const customColorEnabled = useMarkerCustomizationStore((s) => s.customColorEnabled);
  const previewPalette = customColorEnabled ? markerColors.custom : markerColors.flashUncaptured;

  const allInvaders = useInvaderStore((s) => s.invaders);
  const cityPadding = cityNumberPadding(nameCity, allInvaders);
  const proposedName = buildProposedName(nameCity, nameNum, cityPadding);
  const isValid = nameCity.trim().length > 0 && nameNum.trim().length > 0;

  const title = initial
    ? t('customInvaders.editTitle')
    : isPersonal ? t('customInvaders.newTitle') : t('popup.newInvader');

  async function submitPersonal(datePose: string | null) {
    try {
      await onSubmitPersonal({
        name: proposedName,
        city: nameCity.trim().toUpperCase() || null,
        number: nameNum ? Number(nameNum) : null,
        state: invaderState || null,
        points,
        latitude: lat,
        longitude: lon,
        date_pose: datePose,
        icon_shape: iconShape,
      }, imageUri);
      onRequestSent(true);
      onClose();
    } catch {
      setSubmitting(false);
      setUploadError(true);
    }
  }

  async function handleSend() {
    if (!isValid) { setNameError(true); return; }
    setNameError(false);
    setSubmitting(true);
    setOfflineError(false);
    setUploadError(false);

    const datePose = year.length === 4 ? `${year}-01-01` : null;

    if (isPersonal) {
      await submitPersonal(datePose);
      return;
    }

    // Community proposals need an account; personal ones don't.
    requireAccount(() => { void submitCommunity(datePose); });
    setSubmitting(false);
  }

  async function submitCommunity(datePose: string | null) {
    setSubmitting(true);
    try {
      const req = await onSubmitCreateRequest({
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
      onRequestSent(false);
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
        {/* Editing an existing personal invader can't switch destination — it
            already lives in the user's collection. */}
        {!initial && (
          <PersonalToggle value={isPersonal} onChange={setIsPersonal} theme={theme} styles={styles} />
        )}

        {/* Only personal invaders carry their own icon — a community proposal's
            marker follows its (admin-validated) points. */}
        {isPersonal && (
          <>
            <Text style={styles.fieldLabel}>{t('customInvaders.icon')}</Text>
            <IconCarousel
              value={iconShape}
              onChange={setIconShape}
              iconHex={previewPalette.icon}
              glowHex={previewPalette.glow}
            />
          </>
        )}

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

        <Text style={styles.fieldLabel}>{t('popup.photoOptional')}</Text>
        <PhotoField imageUri={imageUri} onChange={setImageUri} />
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

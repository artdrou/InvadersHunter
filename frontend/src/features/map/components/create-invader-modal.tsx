import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { InvaderState } from "@/features/invaders/types";
import { useInvaderStore } from "@/features/invaders/store";
import { cityOf } from "@/features/invaders/utils/invader-list";
import { uploadRequestPhoto, cancelRequest } from "@/features/invaders/services/invaders.api";
import type { CreateRequestPayload, UserRequest } from "@/features/invaders/services/invaders.api";
import { isNetworkError } from "@/services/sync";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontSize } from "@/constants/theme";

const STATE_OPTIONS = [
  InvaderState.Good,
  InvaderState.SlightlyDegraded,
  InvaderState.Degraded,
  InvaderState.BadlyDegraded,
  InvaderState.Destroyed,
  InvaderState.NotVisible,
  InvaderState.Unknown,
] as const;

const STATE_KEYS: Record<string, string> = {
  [InvaderState.Good]:             "states.Good",
  [InvaderState.SlightlyDegraded]: "states.SlightlyDegraded",
  [InvaderState.Degraded]:         "states.Degraded",
  [InvaderState.BadlyDegraded]:    "states.BadlyDegraded",
  [InvaderState.Destroyed]:        "states.Destroyed",
  [InvaderState.NotVisible]:       "states.NotVisible",
  [InvaderState.Unknown]:          "states.Unknown",
};

type Props = {
  lat: number;
  lon: number;
  onPickLocation: () => void;
  onRequestSent: () => void;
  onClose: () => void;
  onSubmitCreateRequest: (payload: CreateRequestPayload) => Promise<UserRequest | null>;
};

export function CreateInvaderModal({ lat, lon, onPickLocation, onRequestSent, onClose, onSubmitCreateRequest }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const [nameCity, setNameCity] = useState("");
  const [nameNum, setNameNum] = useState("");
  const [invaderState, setInvaderState] = useState("");
  const [points, setPoints] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [nameError, setNameError] = useState(false);

  async function pickImage(source: "camera" | "library") {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function handleAddPhoto() {
    Alert.alert(t('popup.addPhotoTitle'), undefined, [
      { text: t('popup.camera'), onPress: () => pickImage("camera") },
      { text: t('popup.gallery'), onPress: () => pickImage("library") },
      { text: t('common.cancel'), style: "cancel" },
    ]);
  }

  const allInvaders = useInvaderStore((s) => s.invaders);

  // Detect the numbering width used by existing invaders in this city.
  // Returns 0 when the city is unknown OR when its existing names use no zero-padding,
  // so the user's number is left exactly as typed in those cases.
  const cityPadding = (() => {
    const city = nameCity.trim().toUpperCase();
    if (!city) return 0;
    const matching = allInvaders.filter((inv) => cityOf(inv.name) === city);
    if (matching.length === 0) return 0;
    for (const inv of matching) {
      const idx = inv.name.indexOf("_");
      if (idx === -1) continue;
      const numStr = inv.name.slice(idx + 1);
      if (/^\d+$/.test(numStr) && numStr.length > 1 && numStr.startsWith("0")) {
        return numStr.length;
      }
    }
    return 0;
  })();

  const numFormatted =
    cityPadding > 0 ? nameNum.trim().padStart(cityPadding, "0") : nameNum.trim();
  const proposedName =
    nameCity.trim().toUpperCase() +
    (nameCity.trim() && nameNum.trim() ? "_" + numFormatted : "");
  const isValid = nameCity.trim().length > 0 && nameNum.trim().length > 0;

  async function handleSend() {
    if (!isValid) { setNameError(true); return; }
    setNameError(false);
    setSubmitting(true);
    setOfflineError(false);
    setUploadError(false);
    try {
      const req = await onSubmitCreateRequest({
        proposed_name: proposedName,
        proposed_latitude: lat,
        proposed_longitude: lon,
        proposed_state: invaderState || null,
        proposed_points: points ? parseInt(points, 10) : null,
      });
      // req is null when queued offline — skip photo upload (no req id yet)
      if (req && imageUri) {
        try {
          await uploadRequestPhoto(req.id, imageUri);
        } catch (uploadErr) {
          await cancelRequest(req.id).catch(() => {});
          setSubmitting(false);
          if (isNetworkError(uploadErr)) {
            setOfflineError(true);
          } else {
            setUploadError(true);
          }
          return;
        }
      }
      onRequestSent();
      onClose();
    } catch (err) {
      setSubmitting(false);
      setUploadError(true);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.scrollHandle} />

      <View style={styles.header}>
        <Text style={styles.title}>{t('popup.newInvader')}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

        <Text style={styles.fieldLabel}>{t('popup.name')}</Text>
        <View style={[styles.nameRow, nameError && styles.nameRowError]}>
          <TextInput
            style={[styles.input, styles.nameCity, nameError && styles.inputError]}
            placeholder="PA"
            placeholderTextColor={theme.textMuted}
            value={nameCity}
            onChangeText={(v) => { setNameCity(v); setNameError(false); }}
            autoCapitalize="characters"
            maxLength={4}
          />
          <Text style={styles.nameSep}>_</Text>
          <TextInput
            style={[styles.input, styles.nameNum, nameError && styles.inputError]}
            placeholder="001"
            placeholderTextColor={theme.textMuted}
            value={nameNum}
            onChangeText={(v) => { setNameNum(v.replace(/\D/g, "")); setNameError(false); }}
            keyboardType="numeric"
            maxLength={4}
          />
          {proposedName.length > 0 && (
            <Text style={styles.namePreview}>{proposedName}</Text>
          )}
        </View>
        {nameError && (
          <Text style={styles.errorMsg}>{t('popup.nameError')}</Text>
        )}

        <Text style={styles.fieldLabel}>{t('popup.points')}</Text>
        <TextInput
          style={styles.input}
          placeholder="—"
          placeholderTextColor={theme.textMuted}
          value={points}
          onChangeText={(v) => setPoints(v.replace(/\D/g, ""))}
          keyboardType="numeric"
          maxLength={4}
        />

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
                    onPress={() => setInvaderState(selected ? "" : s)}
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
          onPress={onPickLocation}
        >
          <Text style={styles.positionValue}>
            {lat.toFixed(6)}, {lon.toFixed(6)}
          </Text>
          <Text style={styles.positionEdit}>{t('popup.edit')}</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>{t('popup.photoOptional')}</Text>
        {imageUri ? (
          <View style={styles.imagePreviewRow}>
            <Image source={{ uri: imageUri }} style={styles.imageThumb} />
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
          styles.submitBtn,
          (!isValid || submitting) && styles.submitBtnDisabled,
          (pressed && isValid && !submitting) && styles.btnPressed,
        ]}
        onPress={handleSend}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>
          {submitting ? t('popup.sending') : t('popup.submit')}
        </Text>
      </Pressable>

      {offlineError && (
        <Text style={styles.offlineMsg}>{t('common.noInternet')}</Text>
      )}
      {uploadError && (
        <Text style={styles.offlineMsg}>{t('popup.photoUploadFailed')}</Text>
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

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    scrollHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.bgDivider,
      alignSelf: "center",
    },
    container: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.lg,
      padding: Spacing.four,
      width: 300,
      gap: 14,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      color: t.accent,
      fontSize: sz(FontSize.lg),
      fontFamily: font,
      letterSpacing: 1,
    },
    closeBtn: {
      padding: Spacing.one,
    },
    closeText: {
      color: t.textMuted,
      fontSize: FontSize.md,
      fontFamily: font,
    },
    divider: {
      height: 1,
      backgroundColor: t.bgDivider,
    },
    form: {
      maxHeight: 340,
    },
    fieldLabel: {
      color: t.textMuted,
      fontSize: sz(12),
      fontFamily: font,
      marginBottom: 4,
      marginTop: Spacing.two,
    },
    input: {
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
    inputError: {
      borderColor: t.danger,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    nameRowError: {},
    nameCity: {
      width: 58,
      textTransform: "uppercase",
    },
    nameSep: {
      color: t.textMuted,
      fontSize: sz(18),
      fontFamily: font,
    },
    nameNum: {
      width: 64,
    },
    namePreview: {
      color: t.textMuted,
      fontSize: sz(13),
      fontFamily: font,
      flexShrink: 1,
    },
    errorMsg: {
      color: t.danger,
      fontSize: sz(11),
      fontFamily: font,
      marginTop: 2,
    },
    stateGrid: {
      gap: 5,
    },
    stateRow: {
      flexDirection: "row",
      gap: 5,
    },
    stateOptionHalf: {
      flex: 1,
    },
    stateOption: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 8,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
    },
    stateOptionSelected: {
      borderColor: t.accent,
      backgroundColor: t.bg,
    },
    stateOptionText: {
      color: t.textMuted,
      fontSize: sz(13),
      fontFamily: font,
    },
    stateOptionTextSelected: {
      color: t.accent,
      fontFamily: font,
    },
    positionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: Spacing.two,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.two,
    },
    positionValue: {
      color: t.text,
      fontSize: sz(12),
      fontFamily: font,
      flexShrink: 1,
    },
    positionEdit: {
      color: t.accent,
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
    },
    submitBtn: {
      backgroundColor: t.accent,
      borderRadius: BorderRadius.sm,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: Spacing.one,
    },
    submitBtnDisabled: {
      backgroundColor: t.bgDivider,
      opacity: 0.6,
    },
    btnPressed: {
      opacity: 0.7,
    },
    submitBtnText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xxl,
      color: t.bg,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 8,
    },
    cancelBtnText: {
      color: t.textMuted,
      fontSize: ButtonFontSize.xl,
      fontFamily: ButtonFont,
    },
    offlineMsg: {
      color: t.danger,
      fontSize: sz(12),
      fontFamily: font,
      textAlign: "center",
    },
    imagePreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: Spacing.two,
    },
    imageThumb: {
      width: 64,
      height: 64,
      borderRadius: BorderRadius.sm,
    },
    removePhotoBtn: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
    },
    removePhotoBtnText: {
      color: t.textMuted,
      fontSize: sz(12),
      fontFamily: font,
    },
    addPhotoBtn: {
      paddingVertical: 10,
      paddingHorizontal: Spacing.two,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.two,
      alignItems: "center",
    },
    addPhotoBtnText: {
      color: t.accent,
      fontSize: sz(13),
      fontFamily: font,
    },
  });
}

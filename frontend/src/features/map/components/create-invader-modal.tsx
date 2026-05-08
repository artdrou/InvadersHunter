import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { InvaderState } from "@/features/invaders/types";
import { submitCreateRequest, uploadRequestPhoto, cancelRequest } from "@/features/invaders/services/invaders.api";
import { isNetworkError } from "@/services/sync";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from "@/constants/theme";

const STATE_OPTIONS = [
  InvaderState.Pristine,
  InvaderState.SlightlyDegraded,
  InvaderState.Degraded,
  InvaderState.BadlyDegraded,
  InvaderState.Destroyed,
  InvaderState.NotVisible,
] as const;

const STATE_LABELS: Record<string, string> = {
  [InvaderState.Pristine]:         "Pristine",
  [InvaderState.SlightlyDegraded]: "Slightly degraded",
  [InvaderState.Degraded]:         "Degraded",
  [InvaderState.BadlyDegraded]:    "Badly degraded",
  [InvaderState.Destroyed]:        "Destroyed",
  [InvaderState.NotVisible]:       "Not visible",
};

type Props = {
  lat: number;
  lon: number;
  onPickLocation: () => void;
  onRequestSent: () => void;
  onClose: () => void;
};

export function CreateInvaderModal({ lat, lon, onPickLocation, onRequestSent, onClose }: Props) {
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
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function handleAddPhoto() {
    Alert.alert("Add photo", undefined, [
      { text: "Camera", onPress: () => pickImage("camera") },
      { text: "Gallery", onPress: () => pickImage("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const proposedName =
    nameCity.trim().toUpperCase() +
    (nameCity.trim() && nameNum.trim() ? "_" + nameNum.trim().padStart(3, "0") : "");
  const isValid = nameCity.trim().length > 0 && nameNum.trim().length > 0;

  async function handleSend() {
    if (!isValid) { setNameError(true); return; }
    setNameError(false);
    setSubmitting(true);
    setOfflineError(false);
    setUploadError(false);
    try {
      const req = await submitCreateRequest({
        proposed_name: proposedName,
        proposed_latitude: lat,
        proposed_longitude: lon,
        proposed_state: invaderState || null,
        proposed_points: points ? parseInt(points, 10) : null,
      });
      if (imageUri) {
        try {
          await uploadRequestPhoto(req.id, imageUri);
        } catch (uploadErr) {
          // Roll back: delete the just-created request and show error
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
      if (isNetworkError(err)) setOfflineError(true);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.scrollHandle} />

      <View style={styles.header}>
        <Text style={styles.title}>Nouvel invader</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

        <Text style={styles.fieldLabel}>Nom</Text>
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
          <Text style={styles.errorMsg}>City code and number are required</Text>
        )}

        <Text style={styles.fieldLabel}>Points</Text>
        <TextInput
          style={styles.input}
          placeholder="—"
          placeholderTextColor={theme.textMuted}
          value={points}
          onChangeText={(v) => setPoints(v.replace(/\D/g, ""))}
          keyboardType="numeric"
          maxLength={4}
        />

        <Text style={styles.fieldLabel}>State</Text>
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
                      {STATE_LABELS[s]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Position</Text>
        <Pressable
          style={({ pressed }) => [styles.positionRow, pressed && styles.btnPressed]}
          onPress={onPickLocation}
        >
          <Text style={styles.positionValue}>
            {lat.toFixed(6)}, {lon.toFixed(6)}
          </Text>
          <Text style={styles.positionEdit}>Edit</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>Photo (optional)</Text>
        {imageUri ? (
          <View style={styles.imagePreviewRow}>
            <Image source={{ uri: imageUri }} style={styles.imageThumb} />
            <Pressable
              onPress={() => setImageUri(null)}
              style={({ pressed }) => [styles.removePhotoBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.removePhotoBtnText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.btnPressed]}
            onPress={handleAddPhoto}
          >
            <Text style={styles.addPhotoBtnText}>Add photo…</Text>
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
          {submitting ? "Sending…" : "Submit"}
        </Text>
      </Pressable>

      {offlineError && (
        <Text style={styles.offlineMsg}>No internet connection</Text>
      )}
      {uploadError && (
        <Text style={styles.offlineMsg}>Photo upload failed — please try again</Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
        onPress={onClose}
      >
        <Text style={styles.cancelBtnText}>Cancel</Text>
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
      fontSize: sz(12),
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
      fontSize: 15,
      color: t.bg,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 8,
    },
    cancelBtnText: {
      color: t.textMuted,
      fontSize: 14,
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

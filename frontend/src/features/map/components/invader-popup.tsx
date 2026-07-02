import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Linking, Alert, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/services/i18n";
import { InvaderState } from "@/features/invaders";
import type { InvaderWithState } from "@/features/invaders";
import { ISS_INVADER_NAME } from "@/features/iss/constants";
import type { ModifyRequestPayload } from "@/features/invaders/services/invaders.api";
import { uploadRequestPhoto } from "@/features/invaders/services/invaders.api";
import type { UserRequest } from "@/features/invaders/types";
import { useSQLiteContext } from "expo-sqlite";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, ButtonFontSize } from "@/constants/theme";

type Props = {
  invader: InvaderWithState;
  pendingCoords?: { lat: number; lon: number } | null;
  onClose: () => void;
  onFlash: (invader: InvaderWithState) => void;
  onUnflash: (invader: InvaderWithState) => void;
  onPickLocation?: (invader: InvaderWithState) => void;
  onHeightChange?: (height: number) => void;
  onRequestSent?: () => void;
  onSubmitModifyRequest: (payload: ModifyRequestPayload) => Promise<UserRequest | null>;
};

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
  [InvaderState.Good]:            "states.Good",
  [InvaderState.SlightlyDegraded]:"states.SlightlyDegraded",
  [InvaderState.Degraded]:        "states.Degraded",
  [InvaderState.BadlyDegraded]:   "states.BadlyDegraded",
  [InvaderState.Destroyed]:       "states.Destroyed",
  [InvaderState.NotVisible]:      "states.NotVisible",
  [InvaderState.Unknown]:         "states.Unknown",
};

function formatDate(iso?: string) {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString(getDateLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function InvaderPopup({ invader, pendingCoords, onClose, onFlash, onUnflash, onPickLocation, onHeightChange, onRequestSent, onSubmitModifyRequest }: Props) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  // Cap the edit form to the available screen height minus the popup chrome
  // (header, dividers, validate/cancel buttons, padding, arrow) so the last
  // field — the photo picker — stays reachable. A fixed cap clipped it once the
  // OS font-scale pushed the content past it, with no scroll cue to reveal it.
  const { height: windowHeight } = useWindowDimensions();
  const formMaxHeight = Math.max(220, windowHeight - 280);

  const [mode, setMode] = useState<"view" | "edit">(pendingCoords ? "edit" : "view");
  const [submitting, setSubmitting] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [offlineError, setOfflineError] = useState(false);

  // Read from local SQLite — works offline, no network call
  useEffect(() => {
    db.getFirstAsync<{ id: number }>(
      'SELECT id FROM user_requests WHERE invader_id = ? AND request_type = ? AND status = ?',
      [invader.id, 'modify', 'pending'],
    ).then((row) => setAlreadySent(!!row)).catch(() => {});
  }, [invader.id, db]);

  const [invaderState, setInvaderState] = useState<string>(invader.state ?? "");
  const [imageUri, setImageUri]         = useState<string | null>(null);
  const [uploadError, setUploadError]   = useState(false);

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

  if (mode === "edit") {
    return (
      <View onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
        <View style={styles.container}>
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

          {offlineError && (
            <Text style={styles.offlineMsg}>{t('common.noInternet')}</Text>
          )}
          {uploadError && (
            <Text style={styles.offlineMsg}>{t('popup.photoUploadFailed')}</Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
            onPress={() => { setOfflineError(false); onClose(); }}
          >
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
        <View style={styles.arrow} />
      </View>
    );
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  const isISS = invader.name === ISS_INVADER_NAME;

  return (
    <View onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.name}>{invader.name}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {invader.image_url && (
          <Image
            source={invader.image_url}
            style={styles.image}
            contentFit="contain"
          />
        )}

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.points')}</Text>
          <Text style={styles.value}>{invader.points ?? "--"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.state')}</Text>
          <Text style={styles.value}>{invader.state ? t(STATE_KEYS[invader.state] ?? invader.state) : "--"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.posed')}</Text>
          <Text style={styles.value}>{formatDate(invader.date_pose ?? undefined)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.flashed')}</Text>
          <Text style={[styles.value, invader.isCaptured && styles.flashedDate]}>
            {formatDate(invader.capturedAt)}
          </Text>
        </View>

        <View style={styles.divider} />

        {!isISS && (
          <View style={styles.linksRow}>
            <Pressable
              onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${invader.latitude},${invader.longitude}`)}
              style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <Ionicons name="navigate" size={20} color={theme.accent} />
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(`https://www.instagram.com/explore/tags/${invader.name.toLowerCase()}/`)}
              style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <Ionicons name="logo-instagram" size={20} color={theme.accent} />
            </Pressable>
          </View>
        )}


        <Pressable
          style={({ pressed }) => [
            styles.flashBtn,
            invader.isCaptured ? styles.unflashBtn : styles.doFlashBtn,
            pressed && styles.btnPressed,
          ]}
          onPress={() => invader.isCaptured ? onUnflash(invader) : onFlash(invader)}>
          <Text style={[styles.flashBtnText, invader.isCaptured && styles.unflashBtnText]}>
            {invader.isCaptured ? t('popup.unflash') : t('popup.flash')}
          </Text>
        </Pressable>

        {!isISS && (
          <Pressable
            onPress={() => {
              if (!alreadySent) { setOfflineError(false); setMode("edit"); }
            }}
            disabled={alreadySent}
            style={({ pressed }) => [styles.modifyLink, pressed && styles.btnPressed]}
          >
            <Text style={[styles.modifyLinkText, alreadySent && styles.modifyLinkDisabledText]}>
              {alreadySent ? t('popup.updateSent') : t('popup.update')}
            </Text>
          </Pressable>
        )}

        {offlineError && (
          <Text style={styles.offlineMsg}>{t('common.noInternet')}</Text>
        )}
      </View>

      <View style={styles.arrow} />
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
    name: {
      color: t.accent,
      fontSize: sz(FontSize.xl),
      fontFamily: font,
      letterSpacing: 1,
      flexShrink: 1,
    },
    closeBtn: {
      padding: Spacing.one,
    },
    closeText: {
      color: t.textMuted,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    divider: {
      height: 1,
      backgroundColor: t.bgDivider,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: {
      color: t.textMuted,
      fontSize: sz(FontSize.lg),
      fontFamily: font,
    },
    value: {
      color: t.text,
      fontSize: sz(FontSize.lg),
      fontFamily: font,
    },
    image: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: BorderRadius.sm,
    },
    flashedDate: {
      color: t.success,
    },
    flashBtn: {
      borderRadius: BorderRadius.sm,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: Spacing.one,
    },
    doFlashBtn: {
      backgroundColor: t.accent,
    },
    validateBtnDisabled: {
      backgroundColor: t.bgDivider,
      opacity: 0.6,
    },
    unflashBtn: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.danger,
    },
    btnPressed: {
      opacity: 0.7,
    },
    flashBtnText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xl,
      color: t.bg,
    },
    unflashBtnText: {
      color: t.danger,
    },
    linksRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.four,
      paddingVertical: Spacing.one,
    },
    linkIconBtn: {
      padding: Spacing.one,
    },
    modifyLink: {
      alignItems: "center",
      paddingVertical: Spacing.one,
    },
    modifyLinkText: {
      color: t.accent,
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
    },
    modifyLinkDisabledText: {
      color: t.textMuted,
      opacity: 0.6,
    },
    form: {
      // maxHeight is applied inline from the window height so the photo field
      // never gets clipped out of reach on tall content / large font scales.
    },
    formContent: {
      paddingBottom: Spacing.two,
    },
    fieldLabel: {
      color: t.textMuted,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
      marginBottom: 4,
      marginTop: Spacing.two,
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
      fontSize: sz(FontSize.sm),
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
      fontSize: sz(FontSize.xs),
      fontFamily: font,
      flexShrink: 1,
    },
    positionEdit: {
      color: t.accent,
      fontSize: ButtonFontSize.md,
      fontFamily: ButtonFont,
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
      fontSize: sz(FontSize.xs),
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
      fontSize: sz(FontSize.xs),
      fontFamily: font,
    },
    addPhotoBtn: {
      paddingVertical: 10,
      paddingHorizontal: Spacing.two,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      alignItems: "center",
      marginBottom: Spacing.two,
    },
    addPhotoBtnText: {
      color: t.accent,
      fontSize: sz(FontSize.xs),
      fontFamily: font,
    },
    arrow: {
      alignSelf: "center",
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 10,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: t.border,
    },
  });
}

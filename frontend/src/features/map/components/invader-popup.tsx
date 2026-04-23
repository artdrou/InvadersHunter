import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Image } from "expo-image";
import { InvaderState } from "@/features/invaders";
import type { InvaderWithState } from "@/features/invaders";
import { submitModifyRequest } from "@/features/invaders/services/invaders.api";
import { isNetworkError } from "@/services/sync";
import { useSQLiteContext } from "expo-sqlite";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from "@/constants/theme";

type Props = {
  invader: InvaderWithState;
  isOffline?: boolean;
  pendingCoords?: { lat: number; lon: number } | null;
  onClose: () => void;
  onFlash: (invader: InvaderWithState) => void;
  onUnflash: (invader: InvaderWithState) => void;
  onPickLocation?: (invader: InvaderWithState) => void;
  onHeightChange?: (height: number) => void;
  onRequestSent?: () => void;
};

const STATE_OPTIONS = [
  InvaderState.Pristine,
  InvaderState.SlightlyDegraded,
  InvaderState.Degraded,
  InvaderState.BadlyDegraded,
  InvaderState.Destroyed,
  InvaderState.NotVisible,
] as const;

const STATE_LABELS: Record<string, string> = {
  [InvaderState.Pristine]:        "Pristine",
  [InvaderState.SlightlyDegraded]:"Slightly degraded",
  [InvaderState.Degraded]:        "Degraded",
  [InvaderState.BadlyDegraded]:   "Badly degraded",
  [InvaderState.Destroyed]:       "Destroyed",
  [InvaderState.NotVisible]:      "Not visible",
};

function formatDate(iso?: string) {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function InvaderPopup({ invader, isOffline = false, pendingCoords, onClose, onFlash, onUnflash, onPickLocation, onHeightChange, onRequestSent }: Props) {
  const db = useSQLiteContext();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

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

  const isUnchanged = invaderState === (invader.state ?? "") && !pendingCoords;

  async function handleSend() {
    setSubmitting(true);
    setOfflineError(false);
    try {
      await submitModifyRequest({
        invader_id: invader.id,
        proposed_state: invaderState || undefined,
        proposed_latitude: pendingCoords?.lat,
        proposed_longitude: pendingCoords?.lon,
      } as any);
      onRequestSent?.();
      onClose();
    } catch (err) {
      setSubmitting(false);
      if (isNetworkError(err)) setOfflineError(true);
    }
  }

  if (mode === "edit") {
    return (
      <View onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
        <View style={styles.container}>
          <View style={styles.scrollHandle} />
          <View style={styles.header}>
            <Text style={styles.name}>Update {invader.name}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

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
                        onPress={() => setInvaderState(s)}
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
              onPress={() => onPickLocation?.(invader)}
            >
              <Text style={styles.positionValue}>
                {pendingCoords
                  ? `${pendingCoords.lat.toFixed(6)}, ${pendingCoords.lon.toFixed(6)}`
                  : `${invader.latitude.toFixed(6)}, ${invader.longitude.toFixed(6)}`}
              </Text>
              <Text style={styles.positionEdit}>Edit</Text>
            </Pressable>

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
              {submitting ? "Sending…" : "Validate"}
            </Text>
          </Pressable>

          {offlineError && (
            <Text style={styles.offlineMsg}>No internet connection</Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
            onPress={() => { setOfflineError(false); onClose(); }}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
        <View style={styles.arrow} />
      </View>
    );
  }

  // ── View mode ─────────────────────────────────────────────────────────────
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
          <Text style={styles.label}>Points</Text>
          <Text style={styles.value}>{invader.points ?? "--"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>State</Text>
          <Text style={styles.value}>{invader.state ?? "--"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Posed</Text>
          <Text style={styles.value}>{formatDate(invader.date_pose ?? undefined)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Flashed</Text>
          <Text style={[styles.value, invader.isCaptured && styles.flashedDate]}>
            {formatDate(invader.capturedAt)}
          </Text>
        </View>

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [
            styles.flashBtn,
            invader.isCaptured ? styles.unflashBtn : styles.doFlashBtn,
            pressed && styles.btnPressed,
          ]}
          onPress={() => invader.isCaptured ? onUnflash(invader) : onFlash(invader)}>
          <Text style={[styles.flashBtnText, invader.isCaptured && styles.unflashBtnText]}>
            {invader.isCaptured ? "Unflash" : "Flash"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (isOffline) { setOfflineError(true); return; }
            if (!alreadySent) { setOfflineError(false); setMode("edit"); }
          }}
          disabled={alreadySent}
          style={({ pressed }) => [styles.modifyLink, pressed && styles.btnPressed]}
        >
          <Text style={[styles.modifyLinkText, alreadySent && styles.modifyLinkDisabledText]}>
            {alreadySent ? "Update sent" : "Update"}
          </Text>
        </Pressable>

        {offlineError && (
          <Text style={styles.offlineMsg}>No internet connection</Text>
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
      fontSize: sz(FontSize.lg),
      fontFamily: font,
      letterSpacing: 1,
      flexShrink: 1,
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
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: {
      color: t.textMuted,
      fontSize: sz(15),
      fontFamily: font,
    },
    value: {
      color: t.text,
      fontSize: sz(15),
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
      fontSize: 15,
      color: t.bg,
    },
    unflashBtnText: {
      color: t.danger,
    },
    modifyLink: {
      alignItems: "center",
      paddingVertical: Spacing.one,
    },
    modifyLinkText: {
      color: t.accent,
      fontSize: 13,
      fontFamily: ButtonFont,
    },
    modifyLinkDisabledText: {
      color: t.textMuted,
      opacity: 0.6,
    },
    form: {
      maxHeight: 320,
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
      backgroundColor: t.bgInputInvalid,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 6,
    },
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
      width: 90,
    },
    pillRow: {
      flexDirection: "row",
      gap: 4,
    },
    pill: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center",
    },
    pillSelected: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    pillText: {
      color: t.textMuted,
      fontSize: sz(13),
      fontFamily: font,
    },
    pillTextSelected: {
      color: t.bg,
      fontFamily: font,
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

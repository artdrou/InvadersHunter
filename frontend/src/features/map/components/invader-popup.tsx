import { useState, useEffect } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from "react-native";
import { Image } from "expo-image";
import type { InvaderWithState } from "@/features/invaders";
import { submitModifyRequest, hasPendingModifyRequest } from "@/features/invaders/services/invaders.api";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from "@/constants/theme";

type Props = {
  invader: InvaderWithState;
  onClose: () => void;
  onFlash: (invader: InvaderWithState) => void;
  onUnflash: (invader: InvaderWithState) => void;
  onHeightChange?: (height: number) => void;
  onRequestSent?: () => void;
};

const POINTS_OPTIONS = [10, 20, 30, 40, 50, 100] as const;
const STATE_OPTIONS = [
  "pristine",
  "slightly degraded",
  "degraded",
  "badly degraded",
  "destroyed",
  "not visible",
] as const;

function formatDate(iso?: string) {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseName(raw: string): { city: string; num: string } {
  const idx = raw.indexOf("_");
  if (idx === -1) return { city: raw.toUpperCase(), num: "" };
  return { city: raw.slice(0, idx).toUpperCase(), num: raw.slice(idx + 1) };
}

export function InvaderPopup({ invader, onClose, onFlash, onUnflash, onHeightChange, onRequestSent }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alreadySent, setAlreadySent] = useState(false);

  useEffect(() => {
    hasPendingModifyRequest(invader.id).then(setAlreadySent).catch(() => {});
  }, [invader.id]);

  const parsed = parseName(invader.name);
  const [nameCity, setNameCity] = useState(parsed.city);
  const [nameNum, setNameNum] = useState(parsed.num);

  const [points, setPoints] = useState<number | null>(invader.points ?? null);
  const [invaderState, setInvaderState] = useState<string>(invader.state ?? "");

  async function handleSend() {
    const newErrors: Record<string, string> = {};
    if (nameCity && !nameNum) newErrors.nameNum = "Number is required";
    if (nameNum && !nameCity) newErrors.nameCity = "City code is required";
    if (nameCity && nameCity.length < 2) newErrors.nameCity = "Min 2 letters";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const proposedName = nameCity && nameNum ? `${nameCity}_${nameNum}` : undefined;
      await submitModifyRequest({
        invader_id: invader.id,
        proposed_name: proposedName,
        proposed_points: points ?? undefined,
        proposed_state: invaderState || undefined,
      });
      onRequestSent?.();
      onClose();
    } catch {
      // keep button active so user can retry
      setSubmitting(false);
    }
  }

  if (mode === "edit") {
    return (
      <View onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
        <View style={styles.container}>
          <View style={styles.scrollHandle} />
          <View style={styles.header}>
            <Text style={styles.name}>Modify {invader.name}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

            <Text style={styles.fieldLabel}>Name</Text>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, styles.nameCity, errors.nameCity && styles.inputError]}
                value={nameCity}
                onChangeText={(v) => { setNameCity(v.toUpperCase().replace(/[^A-Z]/g, "")); setErrors((e) => ({ ...e, nameCity: "" })); }}
                placeholder="PA"
                placeholderTextColor={theme.textMuted}
                maxLength={6}
                autoCapitalize="characters"
              />
              <Text style={styles.nameSep}>_</Text>
              <TextInput
                style={[styles.input, styles.nameNum, errors.nameNum && styles.inputError]}
                value={nameNum}
                onChangeText={(v) => { setNameNum(v.replace(/[^0-9]/g, "")); setErrors((e) => ({ ...e, nameNum: "" })); }}
                placeholder="10"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.fieldLabel}>Points</Text>
            <View style={styles.pillRow}>
              {POINTS_OPTIONS.map((p) => {
                const selected = points === p;
                return (
                  <Pressable
                    key={p}
                    style={[styles.pill, selected && styles.pillSelected]}
                    onPress={() => setPoints(p)}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>State</Text>
            <View style={[styles.stateGrid, { marginBottom: Spacing.two }]}>
              {/* Pairs row */}
              {[STATE_OPTIONS.slice(0, 2), STATE_OPTIONS.slice(2, 4)].map((pair, ri) => (
                <View key={ri} style={styles.stateRow}>
                  {pair.map((s) => {
                    const selected = invaderState === s;
                    return (
                      <Pressable
                        key={s}
                        style={[styles.stateOption, styles.stateOptionHalf, selected && styles.stateOptionSelected]}
                        onPress={() => setInvaderState(s)}
                      >
                        <Text style={[styles.stateOptionText, selected && styles.stateOptionTextSelected]}>{s}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {/* Full-width last option */}
              {(() => {
                const s = STATE_OPTIONS[4];
                const selected = invaderState === s;
                return (
                  <Pressable
                    key={s}
                    style={[styles.stateOption, selected && styles.stateOptionSelected]}
                    onPress={() => setInvaderState(s)}
                  >
                    <Text style={[styles.stateOptionText, selected && styles.stateOptionTextSelected]}>{s}</Text>
                  </Pressable>
                );
              })()}
            </View>

          </ScrollView>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [
              styles.flashBtn,
              styles.doFlashBtn,
              (pressed && !submitting) && styles.btnPressed,
            ]}
            onPress={handleSend}
            disabled={submitting}
          >
            <Text style={styles.flashBtnText}>
              {submitting ? "Sending…" : "Send modification"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
            onPress={onClose}
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
          style={[styles.modifyBtn, alreadySent && styles.modifyBtnDisabled]}
          onPress={() => !alreadySent && setMode("edit")}
        >
          <Text style={[styles.modifyBtnText, alreadySent && styles.modifyBtnDisabledText]}>
            {alreadySent ? "Modification sent" : "Modify"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.arrow} />
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
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
      fontSize: FontSize.lg,
      fontWeight: "bold",
      letterSpacing: 1,
      flexShrink: 1,
    },
    closeBtn: {
      padding: Spacing.one,
    },
    closeText: {
      color: t.textMuted,
      fontSize: FontSize.md,
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
      fontSize: 15,
    },
    value: {
      color: t.text,
      fontSize: 15,
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
    unflashBtn: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.danger,
    },
    btnPressed: {
      opacity: 0.7,
    },
    flashBtnText: {
      fontWeight: "bold",
      fontSize: 15,
      color: t.bg,
    },
    unflashBtnText: {
      color: t.danger,
    },
    modifyBtn: {
      borderRadius: BorderRadius.sm,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.border,
    },
    modifyBtnText: {
      color: t.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    modifyBtnDisabled: {
      borderColor: t.bgDivider,
      backgroundColor: t.bgDivider,
    },
    modifyBtnDisabledText: {
      color: t.textMuted,
      opacity: 0.5,
    },
    form: {
      maxHeight: 320,
    },
    fieldLabel: {
      color: t.textMuted,
      fontSize: 12,
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
      fontSize: 14,
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
      fontSize: 18,
      fontWeight: "bold",
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
      fontSize: 12,
      fontWeight: "600",
    },
    pillTextSelected: {
      color: t.bg,
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
      fontSize: 13,
      textTransform: "capitalize",
    },
    stateOptionTextSelected: {
      color: t.accent,
      fontWeight: "600",
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 8,
    },
    cancelBtnText: {
      color: t.textMuted,
      fontSize: 14,
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

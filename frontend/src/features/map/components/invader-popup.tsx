import { View, Text, Pressable, StyleSheet } from "react-native";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing } from "@/constants/theme";

type Props = {
  invader: InvaderWithState;
  onClose: () => void;
  onFlash: (invader: InvaderWithState) => void;
  onUnflash: (invader: InvaderWithState) => void;
};

function formatDate(iso?: string) {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function InvaderPopup({ invader, onClose, onFlash, onUnflash }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <View>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.name}>{invader.name}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Points</Text>
          <Text style={styles.value}>{invader.points}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Added</Text>
          {/* TODO: add created_at to Invader model */}
          <Text style={styles.value}>--</Text>
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
      </View>

      {/* Arrow pointing down toward the marker */}
      <View style={styles.arrow} />
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
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

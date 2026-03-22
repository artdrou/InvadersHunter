import { View, Text, Pressable, StyleSheet } from "react-native";
import type { InvaderWithState } from "@/features/invaders";

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
  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 16,
    minWidth: 220,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    color: "#ffd000",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: "#666",
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "#222",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: "#666",
    fontSize: 13,
  },
  value: {
    color: "#fff",
    fontSize: 13,
  },
  flashedDate: {
    color: "#1cffb7",
  },
  flashBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  doFlashBtn: {
    backgroundColor: "#ffd000",
  },
  unflashBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ff0062",
  },
  btnPressed: {
    opacity: 0.7,
  },
  flashBtnText: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#000",
  },
  unflashBtnText: {
    color: "#ff0062",
  },
});

import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/contexts/theme-context";
import { BorderRadius, Spacing } from "@/constants/theme";
import { formatDate } from "../utils/invader-list";
import type { InvaderWithState } from "../types";

type Props = {
  invader: InvaderWithState;
  onFlash: (inv: InvaderWithState) => void;
  onUnflash: (inv: InvaderWithState) => void;
  onLocate?: (inv: InvaderWithState) => void;
  containerStyle?: object;
};

export function InvaderInfoPanel({ invader, onFlash, onUnflash, onLocate, containerStyle }: Props) {
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  return (
    <View style={[styles.container, { backgroundColor: theme.bgElement }, containerStyle]}>
      {invader.image_url && (
        <Image
          source={invader.image_url}
          recyclingKey={String(invader.id)}
          style={[styles.image, { backgroundColor: theme.bgElement }]}
          contentFit="contain"
          priority="high"
          transition={150}
        />
      )}

      <View style={[styles.divider, { backgroundColor: theme.bgDivider }]} />

      <InfoRow label="Points" value={String(invader.points ?? "--")} sz={sz} />
      <InfoRow label="State"  value={invader.state ?? "--"} sz={sz} />
      <InfoRow label="Posed"  value={formatDate(invader.date_pose)} sz={sz} />
      <InfoRow
        label="Flashed"
        value={formatDate(invader.capturedAt)}
        valueColor={invader.isCaptured ? theme.success : theme.text}
        sz={sz}
      />

      <View style={[styles.divider, { backgroundColor: theme.bgDivider }]} />

      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            styles.btnFlex,
            invader.isCaptured
              ? { borderWidth: 1, borderColor: theme.danger, backgroundColor: "transparent" }
              : { backgroundColor: theme.accent },
            pressed && styles.btnPressed,
          ]}
          onPress={() => invader.isCaptured ? onUnflash(invader) : onFlash(invader)}
        >
          <Text style={[styles.actionBtnText, { color: invader.isCaptured ? theme.danger : theme.bg, fontFamily: appFont, fontSize: sz(13) }]}>
            {invader.isCaptured ? "Unflash" : "Flash"}
          </Text>
        </Pressable>

        {onLocate && (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.btnFlex,
              { borderWidth: 1, borderColor: theme.accent, backgroundColor: "transparent" },
              pressed && styles.btnPressed,
            ]}
            onPress={() => onLocate(invader)}
          >
            <Text style={[styles.actionBtnText, { color: theme.accent, fontFamily: appFont, fontSize: sz(13) }]}>
              Localiser
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── internal helper ─────────────────────────────────────────────────────────

function InfoRow({ label, value, valueColor, sz }: { label: string; value: string; valueColor?: string; sz: (n: number) => number }) {
  const { theme, appFont } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(13) }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? theme.text, fontFamily: appFont, fontSize: sz(13) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: BorderRadius.sm,
  },
  divider: { height: 1 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {},
  infoValue: {},
  btnRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btnFlex: {
    flex: 1,
  },
  actionBtn: {
    borderRadius: BorderRadius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionBtnText: {},
  btnPressed: { opacity: 0.7 },
});

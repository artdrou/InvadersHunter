import { useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { BorderRadius, Spacing, ButtonFont, FontSize } from "@/constants/theme";
import { hapticTap } from "@/features/settings";
import {
  InvaderCommentsModal,
  CommentCountBadge,
  useCommentSeenStore,
  hasNewComments,
} from "@/features/comments";
import { formatDate } from "../utils/invader-list";
import { useInvaderOverview } from "../hooks/use-invader-overview";
import { usePendingFields } from "../hooks/use-pending-modify";
import { missingFields, type EditField } from "../edit-fields";
import { MissingChip } from "./MissingChip";
import type { InvaderWithState } from "../types";

type Props = {
  invader: InvaderWithState;
  onFlash: (inv: InvaderWithState) => void;
  onUnflash: (inv: InvaderWithState) => void;
  onLocate?: (inv: InvaderWithState) => void;
  /** Propose changes: `field` is the missing detail whose "+ Add" was tapped, null for "Modify". */
  onModify?: (inv: InvaderWithState, field: EditField | null) => void;
  containerStyle?: object;
};

const STATE_KEYS: Record<string, string> = {
  "Good": "states.Good",
  "Slightly degraded": "states.SlightlyDegraded",
  "Degraded": "states.Degraded",
  "Badly degraded": "states.BadlyDegraded",
  "Destroyed": "states.Destroyed",
  "Not visible": "states.NotVisible",
  "Unknown": "states.Unknown",
};

export function InvaderInfoPanel({ invader, onFlash, onUnflash, onLocate, onModify, containerStyle }: Props) {
  const { t } = useTranslation();
  const { theme, fontScale, appFont } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // One request for the popup payload: contributors + comment summary
  const { overview, refresh: refreshSummary } = useInvaderOverview(invader.id);
  const contributors = overview?.contributors ?? null;
  const summary = overview?.comments ?? null;
  const seen = useCommentSeenStore((s) => s.seen);
  const commentCount = summary?.count ?? 0;
  const commentsHaveNew = hasNewComments(seen, invader.id, commentCount);
  const hasLocation = invader.latitude != null && invader.longitude != null;
  const pendingFields = usePendingFields(invader.id);
  // Missing details get a "+ Add"; a detail already proposed shows "pending"
  const missing = onModify ? missingFields(invader) : new Set<EditField>();
  const chip = (field: EditField) => {
    if (!missing.has(field)) return undefined;
    if (pendingFields.has(field)) {
      return <Text style={{ color: theme.textMuted, fontFamily: appFont, fontSize: sz(11) }}>{t('popup.pendingDetail')}</Text>;
    }
    return <MissingChip onPress={() => onModify?.(invader, field)} />;
  };
  const stateLabel = invader.state ? t(STATE_KEYS[invader.state] ?? invader.state) : "--";
  // Full-form attribution: discoverer + most recent updater
  const lastModifier = contributors?.modified_by.length
    ? contributors.modified_by[contributors.modified_by.length - 1]
    : null;

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

      <View style={styles.infoBlock}>
        <InfoRow label={t('popup.points')} value={String(invader.points ?? "--")} chip={chip("points")} sz={sz} />
        <InfoRow label={t('popup.state')}  value={stateLabel} chip={chip("state")} sz={sz} />
        <InfoRow label={t('popup.posed')}  value={formatDate(invader.date_pose)} chip={chip("posed")} sz={sz} />
        {missing.has("location") && (
          <InfoRow label={t('popup.position')} value="--" chip={chip("location")} sz={sz} />
        )}
        {missing.has("photo") && (
          <InfoRow label={t('popup.photo')} value="--" chip={chip("photo")} sz={sz} />
        )}
        <InfoRow
          label={t('popup.flashed')}
          value={formatDate(invader.capturedAt)}
          valueColor={invader.isCaptured ? theme.success : theme.text}
          sz={sz}
        />
      </View>

      {(contributors?.created_by || lastModifier) && (
        <View style={styles.contributorsBlock}>
          {contributors?.created_by && (
            <Text style={[styles.contributorLine, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(12) }]}>
              {t('popup.discoveredByLabel')} <Text style={{ color: theme.accent }}>{contributors.created_by.username}</Text>
            </Text>
          )}
          {lastModifier && (
            <Text style={[styles.contributorLine, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(12) }]}>
              {t('popup.updatedByLabel')} <Text style={{ color: theme.accent }}>{lastModifier.username}</Text>
            </Text>
          )}
        </View>
      )}

      {!hasLocation && (
        <Text style={[styles.contributorLine, styles.noLocation, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(12) }]}>
          {t('popup.noLocation')}
        </Text>
      )}

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
          <Text style={[styles.actionBtnText, { color: invader.isCaptured ? theme.danger : theme.bg, fontFamily: ButtonFont, fontSize: FontSize.lg }]}>
            {invader.isCaptured ? t('popup.unflash') : t('popup.flash')}
          </Text>
        </Pressable>

        {onLocate && hasLocation && (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.btnFlex,
              { borderWidth: 1, borderColor: theme.accent, backgroundColor: "transparent" },
              pressed && styles.btnPressed,
            ]}
            onPress={() => { hapticTap(); onLocate(invader); }}
          >
            <Text style={[styles.actionBtnText, { color: theme.accent, fontFamily: ButtonFont, fontSize: FontSize.lg }]}>
              {t('popup.localiser')}
            </Text>
          </Pressable>
        )}
      </View>

      {onModify && (
        <Pressable
          style={({ pressed }) => [styles.updateLink, pressed && styles.btnPressed]}
          onPress={() => { hapticTap(); onModify(invader, null); }}
        >
          <Text style={[styles.updateLinkText, { color: theme.accent, fontFamily: appFont, fontSize: sz(14) }]}>
            {t('popup.update')}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.commentsBtn, pressed && styles.btnPressed]}
        onPress={() => { hapticTap(); setCommentsOpen(true); }}
      >
        <View>
          <Ionicons name="chatbubbles-outline" size={sz(16)} color={theme.textMuted} />
          <CommentCountBadge count={commentCount} hasNew={commentsHaveNew} />
        </View>
        <Text style={[styles.commentsBtnText, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(13) }]}>
          {t('comments.title')}
        </Text>
      </Pressable>

      <InvaderCommentsModal
        visible={commentsOpen}
        invaderId={invader.id}
        invaderName={invader.name}
        onClose={() => { setCommentsOpen(false); refreshSummary(); }}
      />
    </View>
  );
}

// ─── internal helper ─────────────────────────────────────────────────────────

function InfoRow({ label, value, valueColor, chip, sz }: {
  label: string; value: string; valueColor?: string; chip?: ReactNode; sz: (n: number) => number;
}) {
  const { theme, appFont } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(13) }]}>{label}</Text>
      <View style={styles.valueWithChip}>
        {chip}
        <Text style={[styles.infoValue, { color: valueColor ?? theme.text, fontFamily: appFont, fontSize: sz(13) }]}>{value}</Text>
      </View>
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
  infoBlock: { gap: 4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {},
  valueWithChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoValue: {},
  contributorsBlock: { gap: 4 },
  contributorLine: { textAlign: "center" },
  noLocation: { marginTop: Spacing.two, paddingHorizontal: Spacing.three },
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
  updateLink: { alignItems: "center", paddingVertical: Spacing.one },
  updateLinkText: {},
  commentsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  commentsBtnText: {},
  btnPressed: { opacity: 0.7 },
});

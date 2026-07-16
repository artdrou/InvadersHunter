import { useState } from "react";
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
import type { InvaderWithState } from "../types";

type Props = {
  invader: InvaderWithState;
  onFlash: (inv: InvaderWithState) => void;
  onUnflash: (inv: InvaderWithState) => void;
  onLocate?: (inv: InvaderWithState) => void;
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

export function InvaderInfoPanel({ invader, onFlash, onUnflash, onLocate, containerStyle }: Props) {
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
        <InfoRow label={t('popup.points')} value={String(invader.points ?? "--")} sz={sz} />
        <InfoRow label={t('popup.state')}  value={stateLabel} sz={sz} />
        <InfoRow label={t('popup.posed')}  value={formatDate(invader.date_pose)} sz={sz} />
        <InfoRow
          label={t('popup.flashed')}
          value={formatDate(invader.capturedAt)}
          valueColor={invader.isCaptured ? theme.success : theme.text}
          sz={sz}
        />
      </View>

      {(contributors?.created_by || lastModifier) && (
        <Text style={[styles.contributorLine, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(12) }]}>
          {contributors?.created_by && (
            <>{t('popup.discoveredByLabel')} <Text style={{ color: theme.accent }}>{contributors.created_by.username}</Text></>
          )}
          {contributors?.created_by && lastModifier && '   ·   '}
          {lastModifier && (
            <>{t('popup.updatedByLabel')} <Text style={{ color: theme.accent }}>{lastModifier.username}</Text></>
          )}
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

        {onLocate && (
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
  infoBlock: { gap: 5 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {},
  infoValue: {},
  contributorLine: { textAlign: "left" },
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

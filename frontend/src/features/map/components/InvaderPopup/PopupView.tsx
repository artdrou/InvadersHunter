import { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ThemeTokens } from "@/constants/theme";
import type { InvaderWithState } from "@/features/invaders";
import { useInvaderOverview } from "@/features/invaders";
import {
  InvaderCommentsModal,
  CommentCountBadge,
  useCommentSeenStore,
  hasNewComments,
} from "@/features/comments";
import { GOOGLE_MAPS_DIR_URL, INSTAGRAM_TAG_URL } from "@/constants/config";
import { STATE_KEYS } from "@/features/invaders/state-options";
import { missingFields, type EditField } from "@/features/invaders/edit-fields";
import { MissingChip } from "@/features/invaders/components/MissingChip";
import { formatDate } from "./format";
import { InvaderSpotterModal } from "./InvaderSpotterModal";
import type { PopupStyles } from "./styles";

type Props = {
  invader: InvaderWithState;
  isISS: boolean;
  /** Details this user already proposed (pending review): no "+ Add" for them. */
  pendingFields: Set<EditField>;
  onFlash: (invader: InvaderWithState) => void;
  onUnflash: (invader: InvaderWithState) => void;
  onModify: () => void;
  /** "+ Add" on a missing detail. */
  onAddMissing: (field: EditField) => void;
  onClose: () => void;
  theme: ThemeTokens;
  styles: PopupStyles;
};

/** Read-only popup: details, external links, flash/unflash, and the modify link. */
export function PopupView({ invader, isISS, pendingFields, onFlash, onUnflash, onModify, onAddMissing, onClose, theme, styles }: Props) {
  const { t } = useTranslation();
  const [spotterOpen, setSpotterOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { overview, refresh: refreshSummary } = useInvaderOverview(isISS ? null : invader.id);
  const contributors = overview?.contributors ?? null;
  const summary = overview?.comments ?? null;
  const lastModifier = contributors?.modified_by.length
    ? contributors.modified_by[contributors.modified_by.length - 1]
    : null;

  const seen = useCommentSeenStore((s) => s.seen);
  const commentCount = summary?.count ?? 0;
  const commentsHaveNew = hasNewComments(seen, invader.id, commentCount);
  // Missing details get a "+ Add" (not for the ISS); a detail already proposed shows "pending"
  const missing = isISS ? new Set<EditField>() : missingFields(invader);
  const chip = (field: EditField) => missing.has(field) && (pendingFields.has(field)
    ? <Text style={styles.pendingTag}>{t('popup.pendingDetail')}</Text>
    : <MissingChip onPress={() => onAddMissing(field)} />);

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.name}>{invader.name}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {invader.image_url && (
        <Image source={invader.image_url} style={styles.image} contentFit="contain" />
      )}

      <View style={styles.divider} />

      <View style={styles.infoBlock}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.points')}</Text>
          <View style={styles.valueWithChip}>
            {chip("points")}
            <Text style={styles.value}>{invader.points ?? "--"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.state')}</Text>
          <View style={styles.valueWithChip}>
            {chip("state")}
            <Text style={styles.value}>{invader.state ? t(STATE_KEYS[invader.state] ?? invader.state) : "--"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.posed')}</Text>
          <View style={styles.valueWithChip}>
            {chip("posed")}
            <Text style={styles.value}>{formatDate(invader.date_pose ?? undefined)}</Text>
          </View>
        </View>

        {missing.has("location") && (
          <View style={styles.row}>
            <Text style={styles.label}>{t('popup.position')}</Text>
            <View style={styles.valueWithChip}>{chip("location")}<Text style={styles.value}>--</Text></View>
          </View>
        )}

        {missing.has("photo") && (
          <View style={styles.row}>
            <Text style={styles.label}>{t('popup.photo')}</Text>
            <View style={styles.valueWithChip}>{chip("photo")}<Text style={styles.value}>--</Text></View>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>{t('popup.flashed')}</Text>
          <Text style={[styles.value, invader.isCaptured && styles.flashedDate]}>
            {formatDate(invader.capturedAt)}
          </Text>
        </View>

        {summary?.top && (
          <View style={styles.topCommentRow}>
            <Ionicons name="chatbubble" size={12} color={theme.accent} style={styles.topCommentIcon} />
            <Text style={styles.topCommentText} numberOfLines={2}>{summary.top.body}</Text>
          </View>
        )}
      </View>

      {(contributors?.created_by || lastModifier) && (
        <View style={styles.contributorsBlock}>
          {contributors?.created_by && (
            <Text style={styles.contributorText}>
              {t('popup.discoveredByLabel')}{' '}
              <Text style={styles.contributorName}>{contributors.created_by.username}</Text>
            </Text>
          )}
          {lastModifier && (
            <Text style={styles.contributorText}>
              {t('popup.updatedByLabel')}{' '}
              <Text style={styles.contributorName}>{lastModifier.username}</Text>
            </Text>
          )}
        </View>
      )}

      <View style={styles.divider} />

      {!isISS && (
        <View style={styles.linksRow}>
          {invader.latitude != null && invader.longitude != null && (
            <Pressable
              onPress={() => Linking.openURL(GOOGLE_MAPS_DIR_URL(invader.latitude, invader.longitude))}
              style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <Ionicons name="navigate" size={20} color={theme.accent} />
            </Pressable>
          )}
          <Pressable
            onPress={() => Linking.openURL(INSTAGRAM_TAG_URL(invader.name))}
            style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
            hitSlop={8}
          >
            <Ionicons name="logo-instagram" size={20} color={theme.accent} />
          </Pressable>
          <Pressable
            onPress={() => setSpotterOpen(true)}
            style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
            hitSlop={8}
            accessibilityLabel={t('popup.spotter')}
          >
            <Ionicons name="globe-outline" size={20} color={theme.accent} />
          </Pressable>
          <Pressable
            onPress={() => setCommentsOpen(true)}
            style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
            hitSlop={8}
            accessibilityLabel={t('comments.title')}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={theme.accent} />
            <CommentCountBadge count={commentCount} hasNew={commentsHaveNew} />
          </Pressable>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.flashBtn,
          invader.isCaptured ? styles.unflashBtn : styles.doFlashBtn,
          pressed && styles.btnPressed,
        ]}
        onPress={() => invader.isCaptured ? onUnflash(invader) : onFlash(invader)}
      >
        <Text style={[styles.flashBtnText, invader.isCaptured && styles.unflashBtnText]}>
          {invader.isCaptured ? t('popup.unflash') : t('popup.flash')}
        </Text>
      </Pressable>

      {!isISS && (
        <Pressable
          onPress={onModify}
          style={({ pressed }) => [styles.modifyLink, pressed && styles.btnPressed]}
        >
          <Text style={styles.modifyLinkText}>
            {t('popup.update')}
          </Text>
        </Pressable>
      )}

      {!isISS && (
        <InvaderSpotterModal
          visible={spotterOpen}
          name={invader.name}
          onClose={() => setSpotterOpen(false)}
          theme={theme}
        />
      )}

      {!isISS && (
        <InvaderCommentsModal
          visible={commentsOpen}
          invaderId={invader.id}
          invaderName={invader.name}
          onClose={() => { setCommentsOpen(false); refreshSummary(); }}
        />
      )}
    </>
  );
}

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
import { formatDate } from "./format";
import { InvaderSpotterModal } from "./InvaderSpotterModal";
import type { PopupStyles } from "./styles";

type Props = {
  invader: InvaderWithState;
  isISS: boolean;
  alreadySent: boolean;
  onFlash: (invader: InvaderWithState) => void;
  onUnflash: (invader: InvaderWithState) => void;
  onModify: () => void;
  onClose: () => void;
  theme: ThemeTokens;
  styles: PopupStyles;
};

/** Read-only popup: details, external links, flash/unflash, and the modify link. */
export function PopupView({ invader, isISS, alreadySent, onFlash, onUnflash, onModify, onClose, theme, styles }: Props) {
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

      {summary?.top && (
        <View style={styles.topCommentRow}>
          <Ionicons name="chatbubble" size={12} color={theme.accent} style={styles.topCommentIcon} />
          <Text style={styles.topCommentText} numberOfLines={2}>{summary.top.body}</Text>
        </View>
      )}

      {(contributors?.created_by || lastModifier) && (
        <Text style={styles.contributorText}>
          {contributors?.created_by && (
            <>
              {t('popup.discoveredByLabel')}{' '}
              <Text style={styles.contributorName}>{contributors.created_by.username}</Text>
            </>
          )}
          {contributors?.created_by && lastModifier && '   ·   '}
          {lastModifier && (
            <>
              {t('popup.updatedByLabel')}{' '}
              <Text style={styles.contributorName}>{lastModifier.username}</Text>
            </>
          )}
        </Text>
      )}

      <View style={styles.divider} />

      {!isISS && (
        <View style={styles.linksRow}>
          <Pressable
            onPress={() => Linking.openURL(GOOGLE_MAPS_DIR_URL(invader.latitude, invader.longitude))}
            style={({ pressed }) => [styles.linkIconBtn, pressed && styles.btnPressed]}
            hitSlop={8}
          >
            <Ionicons name="navigate" size={20} color={theme.accent} />
          </Pressable>
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
          onPress={() => { if (!alreadySent) onModify(); }}
          disabled={alreadySent}
          style={({ pressed }) => [styles.modifyLink, pressed && styles.btnPressed]}
        >
          <Text style={[styles.modifyLinkText, alreadySent && styles.modifyLinkDisabledText]}>
            {alreadySent ? t('popup.updateSent') : t('popup.update')}
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

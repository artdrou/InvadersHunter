import { View, Text, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ThemeTokens } from "@/constants/theme";
import type { InvaderWithState } from "@/features/invaders";
import { GOOGLE_MAPS_DIR_URL, INSTAGRAM_TAG_URL } from "@/constants/config";
import { STATE_KEYS } from "./constants";
import { formatDate } from "./format";
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
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { type ThemeTokens, ButtonFont, FontSize, Fonts, Spacing } from "@/constants/theme";
import {
  INVADER_SPOTTER_REFERER,
  INVADER_SPOTTER_FORM_HTML,
  INVADER_SPOTTER_RESOLVE_JS,
  INVADER_SPOTTER_READY,
} from "@/constants/config";

type Props = {
  visible: boolean;
  /** Invader code, e.g. "AIX_01" — drives the listing.php single-invader search. */
  name: string;
  onClose: () => void;
  theme: ThemeTokens;
};

/**
 * Full-screen in-app WebView showing an invader's real page on invader-spotter.art.
 * The two-step Paris resolution and the exact single-invader search live in @/constants/config;
 * here we just keep a loading overlay up until the resolved page posts INVADER_SPOTTER_READY.
 */
export function InvaderSpotterModal({ visible, name, onClose, theme }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  // The listing frame loaded at least once — used to ignore late/subframe errors.
  const loadedRef = useRef(false);
  const styles = makeStyles(theme);

  // Fresh load each time the modal is (re)opened for an invader.
  useEffect(() => {
    if (visible) {
      setError(false);
      setReady(false);
      loadedRef.current = false;
    }
  }, [visible, name]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel={t('common.close', 'Close')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="close" size={26} color={theme.textMuted} />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{t('popup.spotterError')}</Text>
          </View>
        ) : (
          <View style={styles.web}>
            <WebView
              // Remount when the target invader changes so the flow restarts.
              key={name}
              // A self-submitting form (baseUrl on the site) POSTs listing.php with a valid
              // Referer/Origin — react-native-webview drops headers on POST source requests.
              source={{
                html: INVADER_SPOTTER_FORM_HTML(name),
                baseUrl: INVADER_SPOTTER_REFERER,
              }}
              style={styles.web}
              containerStyle={{ backgroundColor: theme.bg }}
              // Resolves the exact single-invader page (2-step for Paris) and posts 'ready'.
              injectedJavaScript={INVADER_SPOTTER_RESOLVE_JS(name)}
              onMessage={(e) => { if (e.nativeEvent.data === INVADER_SPOTTER_READY) setReady(true); }}
              onLoad={(e) => { if (e.nativeEvent.url.includes('listing.php')) loadedRef.current = true; }}
              onError={() => { if (!loadedRef.current) setError(true); }}
            />
            {/* Overlay covers the intermediate browse/resubmit hops until the final page is ready. */}
            {!ready && (
              <View style={[styles.center, styles.overlay]}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderBottomWidth: 1,
      borderBottomColor: t.bgDivider,
    },
    title: {
      flexShrink: 1,
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: FontSize.xl,
      letterSpacing: 1,
    },
    web: {
      flex: 1,
      backgroundColor: t.bg,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.four,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.bg,
    },
    errorText: {
      color: t.textMuted,
      fontFamily: Fonts.sans,
      fontSize: FontSize.md,
      textAlign: "center",
    },
    pressed: { opacity: 0.55 },
  });
}

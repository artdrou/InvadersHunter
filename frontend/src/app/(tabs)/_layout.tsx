import { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Fontisto, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { useConnectivityStore } from "@/services/connectivity";
import { useAuthStore } from "@/features/auth";
import { useFriendsStore } from "@/features/friends/store";
import { usePickerChromeStore } from "@/features/map/store";
import { FontSize } from "@/constants/theme";

/** Tab icon; the active one gets an arcade offset shadow in the theme's title-shadow
 *  colour, like the screen titles. */
function ArcadeIcon({ icon, color, size, focused }: {
  icon: (color: string) => React.ReactNode; color: string; size: number; focused: boolean;
}) {
  const { theme } = useTheme();
  const offset = Math.max(2, Math.round(size / 12));
  return (
    <View style={{ width: size + offset, height: size + offset }}>
      {focused && (
        <View style={{ position: 'absolute', left: offset, top: offset }}>
          {icon(theme.titleShadow)}
        </View>
      )}
      {icon(color)}
    </View>
  );
}

/** Tab label; the active one gets the same arcade offset shadow as its icon. Drawn as two
 *  stacked texts (a textShadow with no blur isn't drawn on Android). */
function ArcadeLabel({ children, color, focused }: { children: string; color: string; focused: boolean }) {
  const { theme, appFont } = useTheme();
  const style = { fontFamily: appFont, fontSize: FontSize.xxs };
  return (
    <View>
      {focused && <Text style={[style, styles.labelShadow, { color: theme.titleShadow }]}>{children}</Text>}
      <Text style={[style, { color }]}>{children}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { appFont, theme } = useTheme();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const setOnline = useConnectivityStore((s) => s.setOnline);
  const isAdmin = useAuthStore((s) => s.user?.is_admin ?? false);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const invitesCount = useFriendsStore((s) => s.overview.incoming.length);
  const pickerActive = usePickerChromeStore((s) => s.pickerActive);

  // Fresh friends list (and invite badge) per account; cleared on logout / user switch.
  useEffect(() => {
    useFriendsStore.getState().reset();
    if (userId != null) useFriendsStore.getState().load();
  }, [userId]);

  // A friend push received while the app is open: refresh so the badge updates now.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      if (n.request.content.data?.screen === "/social") useFriendsStore.getState().load();
    });
    return () => sub.remove();
  }, []);

  // Track previous online state to detect transitions
  const prevOnlineRef = useRef(isOnline);

  const reconnectedOpacity = useRef(new Animated.Value(0)).current;
  const reconnectedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectedOpacity = useRef(new Animated.Value(0)).current;
  const disconnectedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to real-time network changes
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    NetInfo.fetch().then((state) => {
      setOnline(!!state.isConnected);
    });
    return unsub;
  }, [setOnline]);

  // Trigger banners on transitions
  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (isOnline && !wasOnline) {
      // Offline → online: show green "Reconnected"
      if (reconnectedTimer.current) clearTimeout(reconnectedTimer.current);
      reconnectedOpacity.setValue(1);
      reconnectedTimer.current = setTimeout(() => {
        Animated.timing(reconnectedOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, 2000);
    }

    if (!isOnline && wasOnline) {
      // Online → offline: show red "Disconnected"
      if (disconnectedTimer.current) clearTimeout(disconnectedTimer.current);
      disconnectedOpacity.setValue(1);
      disconnectedTimer.current = setTimeout(() => {
        Animated.timing(disconnectedOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, 2000);
    }
  }, [isOnline, reconnectedOpacity, disconnectedOpacity]);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarLabel: (p) => <ArcadeLabel {...p} />,
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarStyle: [
            { backgroundColor: theme.bg, borderTopColor: theme.border },
            pickerActive && { display: "none" },   // full-screen map location picker
          ],
        }}
      >
        <Tabs.Screen
          name="map"
          options={{
            title: t('tabs.map'),
            tabBarIcon: (p) => <ArcadeIcon {...p} icon={(c) => <Fontisto name="map" size={p.size} color={c} />} />,
          }}
        />
        <Tabs.Screen
          name="invader"
          options={{
            title: t('tabs.invaders'),
            tabBarIcon: (p) => <ArcadeIcon {...p} icon={(c) => <MaterialCommunityIcons name="space-invaders" size={p.size} color={c} />} />,
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: t('tabs.social'),
            tabBarBadge: invitesCount > 0 ? invitesCount : undefined,
            tabBarBadgeStyle: { backgroundColor: theme.danger, fontSize: FontSize.xxs },
            tabBarIcon: (p) => <ArcadeIcon {...p} icon={(c) => <MaterialCommunityIcons name="account-group" size={p.size} color={c} />} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: (p) => <ArcadeIcon {...p} icon={(c) => <MaterialCommunityIcons name="cog" size={p.size} color={c} />} />,
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: t('tabs.admin'),
            href: isAdmin ? undefined : null,
            tabBarIcon: (p) => <ArcadeIcon {...p} icon={(c) => <MaterialIcons name="admin-panel-settings" size={p.size} color={c} />} />,
          }}
        />
      </Tabs>

      {/* Subtle offline pill — top-right corner */}
      {!isOnline && (
        <View style={styles.offlinePill} pointerEvents="none">
          <Text style={[styles.pillText, { fontFamily: appFont }]}>{t('connectivity.offline')}</Text>
        </View>
      )}

      {/* Fading red band on disconnection */}
      <Animated.View style={[styles.disconnectedBand, { opacity: disconnectedOpacity }]} pointerEvents="none">
        <Text style={[styles.bandText, { fontFamily: appFont }]}>{t('connectivity.disconnected')}</Text>
      </Animated.View>

      {/* Fading green band on reconnection */}
      <Animated.View style={[styles.reconnectedBand, { opacity: reconnectedOpacity }]} pointerEvents="none">
        <Text style={[styles.bandText, { fontFamily: appFont }]}>{t('connectivity.reconnected')}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelShadow: { position: 'absolute', left: 1, top: 1 },
  root: { flex: 1 },
  offlinePill: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    zIndex: 100,
  },
  pillText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: FontSize.xxs,
  },
  disconnectedBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#c0392b",
    paddingVertical: 4,
    alignItems: "center",
    zIndex: 100,
  },
  reconnectedBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#27ae60",
    paddingVertical: 4,
    alignItems: "center",
    zIndex: 100,
  },
  bandText: {
    color: "#ffffff",
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});

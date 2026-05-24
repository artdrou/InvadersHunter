import { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Fontisto, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { useConnectivityStore } from "@/services/connectivity";
import { useAuthStore } from "@/features/auth";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { appFont, theme } = useTheme();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const setOnline = useConnectivityStore((s) => s.setOnline);
  const isAdmin = useAuthStore((s) => s.user?.is_admin ?? false);

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
          tabBarLabelStyle: { fontFamily: appFont, fontSize: 10 },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        }}
      >
        <Tabs.Screen
          name="map"
          options={{
            title: t('tabs.map'),
            tabBarIcon: ({ color, size }) => <Fontisto name="map" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="invader"
          options={{
            title: t('tabs.invaders'),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="space-invaders" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: t('tabs.admin'),
            href: isAdmin ? undefined : null,
            tabBarIcon: ({ color, size }) => <MaterialIcons name="admin-panel-settings" size={size} color={color} />,
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
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: "600",
  },
});

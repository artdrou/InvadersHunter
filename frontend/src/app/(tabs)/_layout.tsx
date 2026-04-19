import { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "@/contexts/theme-context";
import { useConnectivityStore } from "@/services/connectivity";

export default function TabsLayout() {
  const { appFont, theme } = useTheme();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const setOnline = useConnectivityStore((s) => s.setOnline);

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
          tabBarIconStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="map"     options={{ title: "Carte" }} />
        <Tabs.Screen name="invader" options={{ title: "Invaders" }} />
        <Tabs.Screen name="profile" options={{ title: "Profil" }} />
      </Tabs>

      {/* Subtle offline pill — top-right corner */}
      {!isOnline && (
        <View style={styles.offlinePill} pointerEvents="none">
          <Text style={[styles.pillText, { fontFamily: appFont }]}>Offline</Text>
        </View>
      )}

      {/* Fading red band on disconnection */}
      <Animated.View style={[styles.disconnectedBand, { opacity: disconnectedOpacity }]} pointerEvents="none">
        <Text style={[styles.bandText, { fontFamily: appFont }]}>Disconnected</Text>
      </Animated.View>

      {/* Fading green band on reconnection */}
      <Animated.View style={[styles.reconnectedBand, { opacity: reconnectedOpacity }]} pointerEvents="none">
        <Text style={[styles.bandText, { fontFamily: appFont }]}>Reconnected</Text>
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

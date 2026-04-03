import { Tabs } from "expo-router";
import { useTheme } from "@/contexts/theme-context";

export default function TabsLayout() {
  const { appFont, theme } = useTheme();

  return (
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
  );
}

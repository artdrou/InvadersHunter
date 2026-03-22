import { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebMap } from "@/features/map";
import { fetchInvaders, fetchProgress, mapInvadersWithProgress } from "@/features/invaders";
import type { Invader, Capture } from "@/features/invaders";
import { useAuthStore } from "@/features/auth";

export default function MapScreen() {
    const [invaders, setInvaders] = useState<Invader[]>([]);
    const [progress, setProgress] = useState<Capture[]>([]);
    const user = useAuthStore((s) => s.user!);

    useEffect(() => {
        Promise.all([fetchInvaders(), fetchProgress(user.id)])
            .then(([inv, prog]) => {
                setInvaders(inv);
                setProgress(prog);
            })
            .catch((err) => {
                console.error("API ERROR:", err);
            });
    }, []);
    const invadersWithState = mapInvadersWithProgress(invaders, progress);
  return (
    <View style={styles.container}>
      {/* TODO: remove — dev only */}
      <Text style={styles.debug}>
        [DEV]{'\n'}
        user: {user.username} (id: {user.id}){'\n'}
        invaders: {invadersWithState.length}{'\n'}
        captured: {invadersWithState.filter(i => i.isCaptured).length}
      </Text>

      <WebMap invaders={invadersWithState} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  debug: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: "white",
    padding: 8,
  },
});
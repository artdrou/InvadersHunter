import { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebMap, InvaderPopup } from "@/features/map";
import { fetchInvaders, fetchProgress, flashInvader, unflashInvader, mapInvadersWithProgress } from "@/features/invaders";
import type { Invader, Capture, InvaderWithState } from "@/features/invaders";
import { useAuthStore } from "@/features/auth";

export default function MapScreen() {
  const [invaders, setInvaders] = useState<Invader[]>([]);
  const [progress, setProgress] = useState<Capture[]>([]);
  const [selectedInvader, setSelectedInvader] = useState<InvaderWithState | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchInvaders(), fetchProgress(user.id)])
      .then(([inv, prog]) => {
        setInvaders(inv);
        setProgress(prog);
      })
      .catch((err) => console.error("API ERROR:", err));
  }, [user]);

  const invadersWithState = mapInvadersWithProgress(invaders, progress);

  const handleInvaderClick = useCallback((invader: InvaderWithState) => {
    setSelectedInvader(invader);
  }, []);

  async function handleFlash(invader: InvaderWithState) {
    if (!user) return;
    const capture = await flashInvader(user.id, invader.id);
    setProgress((prev) => [...prev, capture]);
    setSelectedInvader({ ...invader, isCaptured: true, capturedAt: capture.found_at, progressId: capture.id });
  }

  async function handleUnflash(invader: InvaderWithState) {
    if (!invader.progressId) return;
    await unflashInvader(invader.progressId);
    setProgress((prev) => prev.filter((p) => p.id !== invader.progressId));
    setSelectedInvader({ ...invader, isCaptured: false, capturedAt: undefined, progressId: undefined });
  }

  return (
    <View style={styles.container}>
      {/* TODO: remove — dev only */}
      {user && (
        <Text style={styles.debug}>
          [DEV]{'\n'}
          user: {user.username} (id: {user.id}){'\n'}
          invaders: {invadersWithState.length}{'\n'}
          captured: {invadersWithState.filter(i => i.isCaptured).length}
        </Text>
      )}

      <WebMap invaders={invadersWithState} onInvaderClick={handleInvaderClick} />

      {selectedInvader && (
        <View style={styles.popupWrapper}>
          <InvaderPopup
            invader={selectedInvader}
            onClose={() => setSelectedInvader(null)}
            onFlash={handleFlash}
            onUnflash={handleUnflash}
          />
        </View>
      )}
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
  popupWrapper: {
    position: "absolute",
    bottom: "55%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
});

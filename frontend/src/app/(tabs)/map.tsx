import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, View, StyleSheet, Text } from "react-native";
import { WebMap, InvaderPopup } from "@/features/map";
import type { WebMapHandle } from "@/features/map/components/web-map";
import { fetchInvaders, fetchProgress, flashInvader, unflashInvader, mapInvadersWithProgress } from "@/features/invaders";
import type { Invader, Capture, InvaderWithState } from "@/features/invaders";
import { useAuthStore } from "@/features/auth";

const MARKER_GAP = 24;

export default function MapScreen() {
  const [invaders, setInvaders] = useState<Invader[]>([]);
  const [progress, setProgress] = useState<Capture[]>([]);
  const [selectedInvader, setSelectedInvader] = useState<InvaderWithState | null>(null);
  const user = useAuthStore((s) => s.user);
  const mapRef = useRef<WebMapHandle>(null);
  const popupHeightRef = useRef<number>(0);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    mapRef.current?.centerOn(
      invader.latitude,
      invader.longitude,
      popupHeightRef.current / 2 + MARKER_GAP,
    );
  }, []);

  function handlePopupHeight(height: number) {
    popupHeightRef.current = height;
    if (!selectedInvader) return;
    mapRef.current?.centerOn(selectedInvader.latitude, selectedInvader.longitude, height / 2 + MARKER_GAP);
  }

  function showToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastOpacity.setValue(1);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 2000);
  }

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

      <WebMap ref={mapRef} invaders={invadersWithState} onInvaderClick={handleInvaderClick} />

      {selectedInvader && (
        <View style={styles.popupWrapper} pointerEvents="box-none">
          <InvaderPopup
            key={selectedInvader.id}
            invader={selectedInvader}
            onClose={() => setSelectedInvader(null)}
            onFlash={handleFlash}
            onUnflash={handleUnflash}
            onHeightChange={handlePopupHeight}
            onRequestSent={() => { setSelectedInvader(null); showToast(); }}
          />
        </View>
      )}

      <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
        <Text style={styles.toastText}>Modification request sent</Text>
      </Animated.View>
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
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 20,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});

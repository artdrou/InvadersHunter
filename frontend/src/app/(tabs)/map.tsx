import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, View, StyleSheet, Text } from "react-native";
import { WebMap, InvaderPopup, MapFilterBar, applyMapFilter, DEFAULT_FILTER, useLocateStore } from "@/features/map";
import type { MapFilter } from "@/features/map";
import type { WebMapHandle } from "@/features/map/components/web-map";
import { useInvaderData, mapInvadersWithProgress } from "@/features/invaders";
import type { InvaderWithState } from "@/features/invaders";
import { useAuthStore } from "@/features/auth";

export default function MapScreen() {
  const { invaders, progress, syncError, flash, unflash } = useInvaderData();
  const isOfflineEmpty = invaders.length === 0 && syncError === 'network';
  const [selectedInvader, setSelectedInvader] = useState<InvaderWithState | null>(null);
  const [filter, setFilter] = useState<MapFilter>(DEFAULT_FILTER);
  const user = useAuthStore((s) => s.user);
  const mapRef = useRef<WebMapHandle>(null);
  const pendingInvaderId = useLocateStore((s) => s.pendingInvaderId);
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);
  const popupHeightRef = useRef<number>(0);
  // Ref so handlePopupHeight always sees the latest invader (avoids stale closure)
  const selectedInvaderRef = useRef<InvaderWithState | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingZoomRef = useRef<number | undefined>(undefined);

  const invadersWithState = mapInvadersWithProgress(invaders, progress);
  const filteredInvaders = applyMapFilter(invadersWithState, filter);

  // Handle "Localiser" from the invaders tab
  useEffect(() => {
    if (!pendingInvaderId) return;
    if (invadersWithState.length === 0) return;
    const inv = invadersWithState.find((i) => i.id === pendingInvaderId);
    if (!inv) return;
    setPendingInvader(null);
    pendingZoomRef.current = 17;
    selectInvader(inv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvaderId, invaders]);

  function centerOnInvader(invader: InvaderWithState, height: number, zoomLevel?: number) {
    mapRef.current?.centerOn(invader.latitude, invader.longitude, height / 2, zoomLevel);
  }

  const handleInvaderClick = useCallback((invader: InvaderWithState) => {
    selectedInvaderRef.current = invader;
    setSelectedInvader(invader);
  }, []);

  function handlePopupHeight(height: number) {
    popupHeightRef.current = height;
    const invader = selectedInvaderRef.current;
    if (!invader) return;
    const zoom = pendingZoomRef.current;
    pendingZoomRef.current = undefined;
    centerOnInvader(invader, height, zoom);
  }

  function selectInvader(invader: InvaderWithState) {
    selectedInvaderRef.current = invader;
    setSelectedInvader(invader);
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
    const capture = await flash(user.id, invader.id);
    selectInvader({ ...invader, isCaptured: true, capturedAt: capture.found_at, progressId: capture.id });
  }

  async function handleUnflash(invader: InvaderWithState) {
    if (!invader.progressId) return;
    await unflash(invader.progressId);
    selectInvader({ ...invader, isCaptured: false, capturedAt: undefined, progressId: undefined });
  }

  return (
    <View style={styles.container}>
      <WebMap ref={mapRef} invaders={filteredInvaders} onInvaderClick={handleInvaderClick} />

      <View style={styles.filterBar}>
        <MapFilterBar value={filter} onChange={setFilter} />
      </View>

      {selectedInvader && (
        <View style={styles.popupWrapper} pointerEvents="box-none">
          <View
            pointerEvents="box-none"
            onLayout={(e) => handlePopupHeight(e.nativeEvent.layout.height)}
          >
            <InvaderPopup
              key={selectedInvader.id}
              invader={selectedInvader}
              isOffline={syncError === 'network'}
              onClose={() => { selectedInvaderRef.current = null; setSelectedInvader(null); }}
              onFlash={handleFlash}
              onUnflash={handleUnflash}
              onRequestSent={() => { selectedInvaderRef.current = null; setSelectedInvader(null); showToast(); }}
            />
          </View>
        </View>
      )}

      {isOfflineEmpty && (
        <View style={styles.offlineBanner} pointerEvents="none">
          <Text style={styles.offlineText}>No internet connection</Text>
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
  filterBar: {
    position: "absolute",
    bottom: 40,
    left: 16,
    zIndex: 10,
  },
  offlineBanner: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  offlineText: {
    color: "#ffffff",
    fontSize: 13,
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

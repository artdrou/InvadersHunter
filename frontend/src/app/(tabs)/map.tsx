import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { WebMap, InvaderPopup, CreateInvaderModal, MapFilterBar, applyMapFilter, DEFAULT_FILTER, useLocateStore, BoussoleIcon, AimIcon } from "@/features/map";
import { useHeadingStore } from "@/features/map/store";
import type { MapFilter } from "@/features/map";
import type { WebMapHandle } from "@/features/map/components/web-map.native";
import { useInvaderData, mapInvadersWithProgress } from "@/features/invaders";
import type { InvaderWithState } from "@/features/invaders";
import { useAuthStore } from "@/features/auth";
import { useTheme } from "@/contexts/theme-context";
import { Brand, BottomTabInset, AppFont } from "@/constants/theme";
import { hapticTap, hapticSuccess, hapticDisappoint } from "@/features/settings";
import { useRouting } from "@/features/routing/hooks/use-routing";
import { RoutingFAB } from "@/features/routing/components/RoutingFAB";
import { RoutingSheet } from "@/features/routing/components/RoutingSheet";
import type { RoutingPickerTarget } from "@/features/routing/components/RoutingSheet";
import { RouteLayer } from "@/features/routing/components/RouteLayer";

export default function MapScreen() {
  const { t } = useTranslation();
  const { invaders, progress, syncError, flash, unflash, submitModifyRequest, submitCreateRequest } = useInvaderData();
  const isOfflineEmpty = invaders.length === 0 && syncError === 'network';
  const [selectedInvader, setSelectedInvader] = useState<InvaderWithState | null>(null);
  const [filter, setFilter] = useState<MapFilter>(DEFAULT_FILTER);
  const [greyMode, setGreyMode] = useState<"none" | "all" | "unflashed">("all");
  const [colorMode, setColorMode] = useState<"flash" | "rarity">("flash");
  const [isFollowing, setIsFollowing] = useState(false);
  const [picking, setPicking] = useState<{ invader: InvaderWithState; startLat: number; startLon: number } | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ invaderId: number; lat: number; lon: number } | null>(null);
  // create-invader flow
  const [creatingPicker, setCreatingPicker] = useState(false);
  const [creatingModal, setCreatingModal] = useState<{ lat: number; lon: number } | null>(null);
  const [creatingPickLoc, setCreatingPickLoc] = useState<{ lat: number; lon: number } | null>(null);
  const user = useAuthStore((s) => s.user);
  const { theme } = useTheme();
  const mapRef = useRef<WebMapHandle>(null);

  // ── Routing ───────────────────────────────────────────────────────────────
  const { route, loading: routeLoading, error: routeError, computeRoute, clearRoute } = useRouting();
  const [routingSheetOpen, setRoutingSheetOpen] = useState(false);
  const [multiInvaders, setMultiInvaders]       = useState<InvaderWithState[]>([]);
  // A→B / Walk coords
  const [routingFrom, setRoutingFrom]           = useState<[number, number] | null>(null);
  const [routingFromLabel, setRoutingFromLabel] = useState<string | null>(null);
  const [routingTo, setRoutingTo]               = useState<[number, number] | null>(null);
  const [routingToLabel, setRoutingToLabel]     = useState<string | null>(null);
  // Map picker for routing
  const [routingPickerTarget, setRoutingPickerTarget] = useState<'from' | 'to' | null>(null);
  // Highlights active whenever the routing sheet is open (tap to toggle mandatory stops)
  const selectedInvaderIds = useMemo(
    () => routingSheetOpen ? multiInvaders.map((i) => i.id) : undefined,
    [routingSheetOpen, multiInvaders]
  );

  function handleRoutingPickOnMap(target: 'from' | 'to') {
    setRoutingSheetOpen(false);
    setRoutingPickerTarget(target);
  }

  function toggleInvaderSelection(invader: InvaderWithState) {
    hapticTap();
    setMultiInvaders((prev) =>
      prev.some((i) => i.id === invader.id)
        ? prev.filter((i) => i.id !== invader.id)
        : [...prev, invader]
    );
  }

  async function validateRoutingPicker() {
    const c = await mapRef.current?.getCenter();
    if (!c || !routingPickerTarget) return;
    const coords: [number, number] = [c[0], c[1]];
    const label = `${c[1].toFixed(5)}, ${c[0].toFixed(5)}`;
    if (routingPickerTarget === 'from') { setRoutingFrom(coords); setRoutingFromLabel(label); }
    else                                { setRoutingTo(coords);   setRoutingToLabel(label); }
    setRoutingPickerTarget(null);
    setRoutingSheetOpen(true);
  }

  function cancelRoutingPicker() {
    setRoutingPickerTarget(null);
    setRoutingSheetOpen(true);
  }
  const pendingInvaderId = useLocateStore((s) => s.pendingInvaderId);
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);
  const popupHeightRef = useRef<number>(0);
  const selectedInvaderRef = useRef<InvaderWithState | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingZoomRef = useRef<number | undefined>(undefined);

  // Memoised so the marker geojson (and the MapLibre marker layer) only rebuilds
  // when the data or filter actually changes — not on every unrelated re-render
  // (toast, selection, popup…), which otherwise blocks the JS thread and lags taps.
  const invadersWithState = useMemo(
    () => mapInvadersWithProgress(invaders, progress),
    [invaders, progress]
  );
  const filteredInvaders = useMemo(
    () => applyMapFilter(invadersWithState, filter),
    [invadersWithState, filter]
  );

  useEffect(() => {
    if (!selectedInvader) return;
    const updated = invadersWithState.find((i) => i.id === selectedInvader.id);
    if (!updated) return;
    if (updated.progressId !== selectedInvader.progressId || updated.isPending !== selectedInvader.isPending) {
      selectedInvaderRef.current = updated;
      setSelectedInvader(updated);
    }
  }, [invadersWithState]);

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
    if (invader.latitude == null || invader.longitude == null) return;
    mapRef.current?.centerOn(invader.latitude, invader.longitude, height / 2, zoomLevel);
  }

  const handleInvaderClick = useCallback((invader: InvaderWithState) => {
    if (routingSheetOpen) { toggleInvaderSelection(invader); return; }
    if (picking || creatingPicker || creatingModal || creatingPickLoc) return;
    selectedInvaderRef.current = invader;
    setSelectedInvader(invader);
  }, [routingSheetOpen, picking, creatingPicker, creatingModal, creatingPickLoc]);

  function handleLongPress(lat: number, lon: number) {
    if (picking || creatingModal || creatingPickLoc) return;
    selectedInvaderRef.current = null;
    setSelectedInvader(null);
    setIsFollowing(false);
    mapRef.current?.centerOn(lat, lon, 0, 17);
    setCreatingPicker(true);
  }

  function cancelCreating() {
    setCreatingPicker(false);
  }

  async function openCreateModal() {
    const c = await mapRef.current?.getCenter();
    if (!c) return;
    setCreatingPicker(false);
    setCreatingModal({ lat: c[1], lon: c[0] });
  }

  function startCreatingPickLoc() {
    if (!creatingModal) return;
    setCreatingPickLoc({ lat: creatingModal.lat, lon: creatingModal.lon });
    setCreatingModal(null);
    mapRef.current?.centerOn(creatingModal.lat, creatingModal.lon, 0, 17);
  }

  async function validateCreatingPickLoc() {
    const c = await mapRef.current?.getCenter();
    setCreatingModal({ lat: c ? c[1] : creatingPickLoc!.lat, lon: c ? c[0] : creatingPickLoc!.lon });
    setCreatingPickLoc(null);
  }

  function cancelCreatingPickLoc() {
    setCreatingModal({ lat: creatingPickLoc!.lat, lon: creatingPickLoc!.lon });
    setCreatingPickLoc(null);
  }

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
    hapticSuccess();
    selectInvader({ ...invader, isCaptured: true, capturedAt: capture.found_at, progressId: capture.id });
  }

  async function handleUnflash(invader: InvaderWithState) {
    if (!invader.progressId) return;
    await unflash(invader.progressId);
    hapticDisappoint();
    selectInvader({ ...invader, isCaptured: false, capturedAt: undefined, progressId: undefined });
  }

  function startPickingLocation(invader: InvaderWithState) {
    if (invader.latitude == null || invader.longitude == null) return;
    const startLat = pendingCoords?.invaderId === invader.id ? pendingCoords.lat : invader.latitude;
    const startLon = pendingCoords?.invaderId === invader.id ? pendingCoords.lon : invader.longitude;
    setSelectedInvader(null);
    selectedInvaderRef.current = null;
    setPicking({ invader, startLat, startLon });
    mapRef.current?.centerOn(startLat, startLon, 0, 17);
  }

  async function validatePicking() {
    if (!picking) return;
    hapticTap();
    const c = await mapRef.current?.getCenter();
    if (c) {
      setPendingCoords({ invaderId: picking.invader.id, lon: c[0], lat: c[1] });
    }
    const inv = picking.invader;
    setPicking(null);
    selectInvader(inv);
  }

  function cancelPicking() {
    if (!picking) return;
    hapticTap();
    const inv = picking.invader;
    setPicking(null);
    selectInvader(inv);
  }

  const anyCreating = creatingPicker || !!creatingModal || !!creatingPickLoc || !!routingPickerTarget;

  return (
    <View style={styles.container}>
      <WebMap ref={mapRef} invaders={filteredInvaders} onInvaderClick={handleInvaderClick} onLongPress={handleLongPress} isFollowing={isFollowing} onHeadingChange={useHeadingStore.getState().setHeading} greyMode={greyMode} colorMode={colorMode} highlightedIds={selectedInvaderIds} routeLayer={<RouteLayer route={route} fromCoords={routingFrom} toCoords={routingTo} fromIsUserLocation={routingFromLabel === t('routing.myLocation')} />}>
      </WebMap>

      {!picking && !anyCreating && (
        <View style={styles.filterBar}>
          <MapFilterBar value={filter} onChange={setFilter} greyMode={greyMode} onGreyModeChange={setGreyMode} colorMode={colorMode} onColorModeChange={setColorMode} />
        </View>
      )}

      <View style={styles.locateButton} pointerEvents="box-none">
        <AimIcon
          locked={isFollowing}
          size={48}
          colorCircle={theme.bgElement}
          colorRing={theme.accent}
          colorCircleLocked="#f90060"
          colorRingLocked={theme.bgElement}
          onPress={() => { setIsFollowing(false); mapRef.current?.centerOnUser(); }}
          onLongPress={() => setIsFollowing(true)}
        />
      </View>

      <View style={styles.compassButton} pointerEvents="box-none">
        <BoussoleIcon
          onPress={() => mapRef.current?.resetNorth()}
          size={48}
          colorCircle={theme.bgElement}
          colorNorth={theme.danger}
          colorSouth={theme.text}
        />
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
              pendingCoords={pendingCoords?.invaderId === selectedInvader.id ? { lat: pendingCoords.lat, lon: pendingCoords.lon } : null}
              onClose={() => { selectedInvaderRef.current = null; setSelectedInvader(null); setPendingCoords(null); }}
              onFlash={handleFlash}
              onUnflash={handleUnflash}
              onPickLocation={startPickingLocation}
              onRequestSent={() => { selectedInvaderRef.current = null; setSelectedInvader(null); setPendingCoords(null); showToast(); }}
              onSubmitModifyRequest={submitModifyRequest}
            />
          </View>
        </View>
      )}

      {isOfflineEmpty && (
        <View style={styles.offlineBanner} pointerEvents="none">
          <Text style={styles.offlineText}>{t('common.noInternet')}</Text>
        </View>
      )}

      {routeLoading && !routingSheetOpen && (
        <View style={styles.routingLoader} pointerEvents="none">
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.routingLoaderText}>{t('routing.computing')}</Text>
        </View>
      )}

      <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
        <Text style={styles.toastText}>{t('map.modificationSent')}</Text>
      </Animated.View>

      {/* ── Create-invader: initial pin + small popup ── */}
      {creatingPicker && (
        <>
          <View style={styles.pickerPinWrapper} pointerEvents="none">
            <View style={[styles.pickerPin, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
            <View style={[styles.pickerPinStem, { backgroundColor: theme.accent }]} />
          </View>

          <View style={styles.createPopupWrapper} pointerEvents="box-none">
            <View style={[styles.createPopupCard, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
              <Text style={[styles.createPopupLabel, { color: theme.text }]}>{t('map.createHere')}</Text>
              <TouchableOpacity
                style={[styles.createPopupBtn, { backgroundColor: theme.accent }]}
                onPress={openCreateModal}
              >
                <Text style={[styles.createPopupBtnText, { color: theme.bg }]}>{t('map.createBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createPopupBtn, { borderColor: theme.border, borderWidth: 1 }]}
                onPress={cancelCreating}
              >
                <Text style={[styles.createPopupBtnText, { color: theme.textMuted }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Create-invader: full form modal ── */}
      {creatingModal && (
        <View style={styles.popupWrapper} pointerEvents="box-none">
          <CreateInvaderModal
            lat={creatingModal.lat}
            lon={creatingModal.lon}
            onPickLocation={startCreatingPickLoc}
            onRequestSent={() => { setCreatingModal(null); showToast(); }}
            onClose={() => setCreatingModal(null)}
            onSubmitCreateRequest={submitCreateRequest}
          />
        </View>
      )}

      {/* ── Create-invader: location picker ── */}
      {creatingPickLoc && (
        <>
          <View style={styles.pickerPinWrapper} pointerEvents="none">
            <View style={[styles.pickerPin, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
            <View style={[styles.pickerPinStem, { backgroundColor: theme.accent }]} />
          </View>
          <View style={styles.pickerBar}>
            <TouchableOpacity
              style={[styles.pickerBtn, { borderColor: theme.border, backgroundColor: theme.bgElement }]}
              onPress={cancelCreatingPickLoc}
            >
              <Text style={[styles.pickerBtnText, { color: theme.textMuted }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: theme.accent }]}
              onPress={validateCreatingPickLoc}
            >
              <Text style={[styles.pickerBtnText, { color: theme.bg }]}>{t('common.validate')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Routing FAB ── */}
      {!picking && !anyCreating && (
        <View style={styles.routingFAB} pointerEvents="box-none">
          <RoutingFAB
            active={routingSheetOpen}
            theme={theme}
            onPress={() => setRoutingSheetOpen((v) => !v)}
          />
        </View>
      )}

      {/* ── Routing Sheet ── */}
      {routingSheetOpen && (
        <RoutingSheet
          onClose={() => setRoutingSheetOpen(false)}
          fromCoords={routingFrom}
          fromLabel={routingFromLabel}
          toCoords={routingTo}
          toLabel={routingToLabel}
          onSetCoords={(target, coords, label) => {
            if (target === 'from') { setRoutingFrom(coords); setRoutingFromLabel(label); }
            else                   { setRoutingTo(coords);   setRoutingToLabel(label); }
            if (route) clearRoute();
          }}
          onClearCoords={(target) => {
            if (target === 'from') { setRoutingFrom(null); setRoutingFromLabel(null); }
            else                   { setRoutingTo(null);   setRoutingToLabel(null); }
            if (route) clearRoute();
          }}
          onPickOnMap={handleRoutingPickOnMap}
          allInvaders={invadersWithState}
          multiInvaders={multiInvaders}
          userLocation={mapRef.current?.getUserCoords() ?? null}
          loading={routeLoading}
          error={routeError}
          route={route}
          onCompute={(params) => {
            computeRoute(params);
            setRoutingSheetOpen(false);
            setMultiInvaders([]);
          }}
          onClear={clearRoute}
          onClearMulti={() => setMultiInvaders([])}
        />
      )}

      {/* ── Routing map picker ── */}
      {routingPickerTarget && (
        <>
          <View style={styles.pickerPinWrapper} pointerEvents="none">
            <View style={[styles.pickerPin, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
            <View style={[styles.pickerPinStem, { backgroundColor: theme.accent }]} />
          </View>
          <View style={styles.pickerBar}>
            <TouchableOpacity
              style={[styles.pickerBtn, { borderColor: theme.border, backgroundColor: theme.bgElement }]}
              onPress={cancelRoutingPicker}
            >
              <Text style={[styles.pickerBtnText, { color: theme.textMuted }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: theme.accent }]}
              onPress={validateRoutingPicker}
            >
              <Text style={[styles.pickerBtnText, { color: theme.bg }]}>{t('common.validate')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Modify-invader: location picker ── */}
      {picking && (
        <>
          <View style={styles.pickerPinWrapper} pointerEvents="none">
            <View style={[styles.pickerPin, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
            <View style={[styles.pickerPinStem, { backgroundColor: theme.accent }]} />
          </View>
          <View style={styles.pickerBar}>
            <TouchableOpacity
              style={[styles.pickerBtn, { borderColor: theme.border, backgroundColor: theme.bgElement }]}
              onPress={cancelPicking}
            >
              <Text style={[styles.pickerBtnText, { color: theme.textMuted }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: theme.accent }]}
              onPress={validatePicking}
            >
              <Text style={[styles.pickerBtnText, { color: theme.bg }]}>{t('common.validate')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    bottom: 32,
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
  routingLoader: {
    position: "absolute",
    bottom: BottomTabInset + 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Brand.cyan,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 20,
  },
  routingLoaderText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: AppFont,
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
  routingFAB: {
    position: "absolute",
    bottom: 140,
    left: 16,
    width: 54,
    height: 54,
    zIndex: 5,
  },
  locateButton: {
    position: "absolute",
    bottom: 32,
    right: 16,
    width: 48,
    height: 48,
    zIndex: 10,
  },
  compassButton: {
    position: "absolute",
    bottom: 86, // 32 + 48 + 6 — same vertical gap (6) as between the filter buttons
    right: 16,
    width: 48,
    height: 48,
    zIndex: 10,
  },
  pickerPinWrapper: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15,
  },
  pickerPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginBottom: 18,
  },
  pickerPinStem: {
    position: "absolute",
    width: 2,
    height: 10,
    top: "50%",
    marginTop: -1,
  },
  pickerBar: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
    zIndex: 20,
  },
  pickerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
  pickerBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  createPopupWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "52%",
    alignItems: "center",
    zIndex: 20,
  },
  createPopupCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    minWidth: 160,
    alignItems: "center",
  },
  createPopupLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  createPopupBtn: {
    width: "100%",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  createPopupBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

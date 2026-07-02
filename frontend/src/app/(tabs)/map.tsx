import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PixelButton } from "@/components/ui/PixelButton";
import {
  WebMap, InvaderPopup, CreateInvaderModal, MapFilterBar,
  applyMapFilter, DEFAULT_FILTER, useLocateStore, BoussoleIcon, AimIcon,
} from "@/features/map";
import type { MapFilter } from "@/features/map";
import type { WebMapHandle } from "@/features/map/components/WebMap.native";
import { MapLocationPicker } from "@/features/map/components/MapLocationPicker";
import { CreateHerePopup } from "@/features/map/components/CreateHerePopup";
import { MapToast } from "@/features/map/components/MapToast";
import { useToast } from "@/features/map/hooks/use-toast";
import { useMapRouting } from "@/features/map/hooks/use-map-routing";
import { useMapCreateFlow } from "@/features/map/hooks/use-map-create-flow";
import { useHeadingStore } from "@/features/map/store";
import { MapZoom } from "@/features/map/constants";
import { useNewsUnreadCount } from "@/features/news";
import { useInvaderData, mapInvadersWithProgress } from "@/features/invaders";
import type { InvaderWithState } from "@/features/invaders";
import { useAuthStore } from "@/features/auth";
import { useTheme } from "@/contexts/theme-context";
import { Brand, White, Overlay, BottomTabInset, AppFont, FontSize, Spacing, BorderRadius, ZIndex, Motion } from "@/constants/theme";
import { hapticSuccess, hapticDisappoint, hapticTap } from "@/features/settings";
import { RoutingFAB } from "@/features/routing/components/RoutingFAB";
import { RoutingSheet } from "@/features/routing/components/RoutingSheet";
import { RouteLayer } from "@/features/routing/components/RouteLayer";

export default function MapScreen() {
  const { t } = useTranslation();
  const { invaders, progress, syncError, flash, unflash, submitModifyRequest, submitCreateRequest } = useInvaderData();
  const isOfflineEmpty = invaders.length === 0 && syncError === "network";
  const [selectedInvader, setSelectedInvader] = useState<InvaderWithState | null>(null);
  const [filter, setFilter] = useState<MapFilter>(DEFAULT_FILTER);
  const [greyMode, setGreyMode] = useState<"none" | "all" | "unflashed">("all");
  const [colorMode, setColorMode] = useState<"flash" | "rarity">("flash");
  const [isFollowing, setIsFollowing] = useState(false);
  // Modify-invader location picker
  const [picking, setPicking] = useState<{ invader: InvaderWithState; startLat: number; startLon: number } | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ invaderId: number; lat: number; lon: number } | null>(null);
  const user = useAuthStore((s) => s.user);
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const newsUnread = useNewsUnreadCount();
  const mapRef = useRef<WebMapHandle>(null);

  // Self-contained flows (routing / create-invader / toast) live in their own hooks.
  const routing = useMapRouting(mapRef);
  const create = useMapCreateFlow(mapRef);
  const toast = useToast();

  const pendingInvaderId = useLocateStore((s) => s.pendingInvaderId);
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);
  const popupHeightRef = useRef<number>(0);
  const selectedInvaderRef = useRef<InvaderWithState | null>(null);
  const pendingZoomRef = useRef<number | undefined>(undefined);
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoised so the marker geojson (and the MapLibre marker layer) only rebuilds
  // when the data or filter actually changes — not on every unrelated re-render
  // (toast, selection, popup…), which otherwise blocks the JS thread and lags taps.
  const invadersWithState = useMemo(
    () => mapInvadersWithProgress(invaders, progress),
    [invaders, progress],
  );
  const filteredInvaders = useMemo(
    () => applyMapFilter(invadersWithState, filter),
    [invadersWithState, filter],
  );

  useEffect(() => {
    if (!selectedInvader) return;
    const updated = invadersWithState.find((i) => i.id === selectedInvader.id);
    if (!updated) return;
    if (updated.progressId !== selectedInvader.progressId || updated.isPending !== selectedInvader.isPending) {
      selectedInvaderRef.current = updated;
      setSelectedInvader(updated);
    }
  // Runs only when the dataset changes; reads (not tracks) the current selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invadersWithState]);

  // Consume a pending deep-link only while THIS map is focused. A plain useEffect
  // fires on the background map (still mounted under a pushed screen like /news),
  // which would clear pendingInvaderId before the visible map ever sees it.
  useFocusEffect(
    useCallback(() => {
      if (!pendingInvaderId) return;
      if (invadersWithState.length === 0) return;
      const inv = invadersWithState.find((i) => i.id === pendingInvaderId);
      if (!inv) return;
      setPendingInvader(null);
      pendingZoomRef.current = MapZoom.detail;
      selectInvader(inv);
      // The camera move (via handlePopupHeight) fires during the tab/focus
      // transition and can be dropped or clobbered by the map's initial camera.
      // Re-assert it once the transition settles and the popup has laid out.
      // The timer lives in a ref rather than the effect cleanup: setPendingInvader(null)
      // above re-runs this focus effect, and a cleanup-based timer would be cleared
      // immediately — so the re-assert would never fire.
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
      locateTimerRef.current = setTimeout(() => centerOnInvader(inv, popupHeightRef.current || 0, MapZoom.detail), Motion.reassert);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingInvaderId, invadersWithState]),
  );

  // Cancel any pending locate re-assert on unmount.
  useEffect(() => () => { if (locateTimerRef.current) clearTimeout(locateTimerRef.current); }, []);

  function centerOnInvader(invader: InvaderWithState, height: number, zoomLevel?: number) {
    if (invader.latitude == null || invader.longitude == null) return;
    mapRef.current?.centerOn(invader.latitude, invader.longitude, height / 2, zoomLevel);
  }

  const { sheetOpen: routingSheetOpen, toggleInvaderSelection } = routing;
  const creatingActive = create.anyActive;
  const handleInvaderClick = useCallback((invader: InvaderWithState) => {
    if (routingSheetOpen) { toggleInvaderSelection(invader); return; }
    if (picking || creatingActive) return;
    selectedInvaderRef.current = invader;
    setSelectedInvader(invader);
  }, [routingSheetOpen, toggleInvaderSelection, picking, creatingActive]);

  function handleLongPress(lat: number, lon: number) {
    if (picking || create.modal || create.pickLoc) return;
    selectedInvaderRef.current = null;
    setSelectedInvader(null);
    setIsFollowing(false);
    create.begin(lat, lon);
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

  // ── Modify-invader location picker ────────────────────────────────────────
  function startPickingLocation(invader: InvaderWithState) {
    if (invader.latitude == null || invader.longitude == null) return;
    const startLat = pendingCoords?.invaderId === invader.id ? pendingCoords.lat : invader.latitude;
    const startLon = pendingCoords?.invaderId === invader.id ? pendingCoords.lon : invader.longitude;
    setSelectedInvader(null);
    selectedInvaderRef.current = null;
    setPicking({ invader, startLat, startLon });
    mapRef.current?.centerOn(startLat, startLon, 0, MapZoom.detail);
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

  const anyCreating = create.anyActive || routing.pickerTarget !== null;

  return (
    <View style={styles.container}>
      <WebMap
        ref={mapRef}
        invaders={filteredInvaders}
        onInvaderClick={handleInvaderClick}
        onLongPress={handleLongPress}
        isFollowing={isFollowing}
        onHeadingChange={useHeadingStore.getState().setHeading}
        greyMode={greyMode}
        colorMode={colorMode}
        highlightedIds={routing.selectedInvaderIds}
        routeLayer={
          <RouteLayer
            route={routing.route}
            fromCoords={routing.from}
            toCoords={routing.to}
            fromIsUserLocation={routing.fromLabel === t("routing.myLocation")}
            onInvaderPress={handleInvaderClick}
          />
        }
      />

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
          colorCircleLocked={Brand.pink}
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

      {/* News shortcut — top-right, routes to the shared /news screen */}
      <TouchableOpacity
        style={[styles.newsButton, { top: insets.top + Spacing.two }]}
        onPress={() => { hapticTap(); router.push("/news"); }}
        activeOpacity={0.8}
      >
        <PixelButton size={48} fill={theme.bgElement} stroke={newsUnread > 0 ? theme.accent : theme.border} />
        <MaterialCommunityIcons name="newspaper-variant-outline" size={22} color={newsUnread > 0 ? theme.accent : theme.textMuted} />
        {newsUnread > 0 && (
          <View style={[styles.newsBadge, { backgroundColor: theme.danger, borderColor: theme.bg }]}>
            <Text style={styles.newsBadgeText}>{newsUnread > 9 ? "9+" : String(newsUnread)}</Text>
          </View>
        )}
      </TouchableOpacity>

      {selectedInvader && (
        <View style={styles.popupWrapper} pointerEvents="box-none">
          <View pointerEvents="box-none" onLayout={(e) => handlePopupHeight(e.nativeEvent.layout.height)}>
            <InvaderPopup
              key={selectedInvader.id}
              invader={selectedInvader}
              pendingCoords={pendingCoords?.invaderId === selectedInvader.id ? { lat: pendingCoords.lat, lon: pendingCoords.lon } : null}
              onClose={() => { selectedInvaderRef.current = null; setSelectedInvader(null); setPendingCoords(null); }}
              onFlash={handleFlash}
              onUnflash={handleUnflash}
              onPickLocation={startPickingLocation}
              onRequestSent={() => { selectedInvaderRef.current = null; setSelectedInvader(null); setPendingCoords(null); toast.show(); }}
              onSubmitModifyRequest={submitModifyRequest}
            />
          </View>
        </View>
      )}

      {isOfflineEmpty && (
        <View style={styles.offlineBanner} pointerEvents="none">
          <Text style={styles.offlineText}>{t("common.noInternet")}</Text>
        </View>
      )}

      {routing.loading && !routing.sheetOpen && (
        <View style={styles.routingLoader} pointerEvents="none">
          <ActivityIndicator size="small" color={White} />
          <Text style={styles.routingLoaderText}>{t("routing.computing")}</Text>
        </View>
      )}

      <MapToast opacity={toast.opacity} message={t("map.modificationSent")} />

      {/* ── Create-invader: initial pin + "create here" card ── */}
      {create.pickerOpen && (
        <CreateHerePopup onCreate={create.openModal} onCancel={create.cancel} />
      )}

      {/* ── Create-invader: full form modal ── */}
      {create.modal && (
        <View style={styles.popupWrapper} pointerEvents="box-none">
          <CreateInvaderModal
            lat={create.modal.lat}
            lon={create.modal.lon}
            onPickLocation={create.startPickLoc}
            onRequestSent={() => { create.closeModal(); toast.show(); }}
            onClose={create.closeModal}
            onSubmitCreateRequest={submitCreateRequest}
          />
        </View>
      )}

      {/* ── Create-invader: location picker ── */}
      {create.pickLoc && (
        <MapLocationPicker onCancel={create.cancelPickLoc} onValidate={create.validatePickLoc} />
      )}

      {/* ── Routing FAB ── */}
      {!picking && !anyCreating && (
        <View style={styles.routingFAB} pointerEvents="box-none">
          <RoutingFAB active={routing.sheetOpen} theme={theme} onPress={() => routing.setSheetOpen((v) => !v)} />
        </View>
      )}

      {/* ── Routing sheet ── */}
      {routing.sheetOpen && (
        <RoutingSheet
          onClose={() => routing.setSheetOpen(false)}
          fromCoords={routing.from}
          fromLabel={routing.fromLabel}
          toCoords={routing.to}
          toLabel={routing.toLabel}
          onSetCoords={routing.onSetCoords}
          onClearCoords={routing.onClearCoords}
          onPickOnMap={routing.handlePickOnMap}
          allInvaders={invadersWithState}
          multiInvaders={routing.multiInvaders}
          userLocation={mapRef.current?.getUserCoords() ?? null}
          loading={routing.loading}
          error={routing.error}
          route={routing.route}
          onCompute={routing.onCompute}
          onClear={routing.clearRoute}
          onClearMulti={() => routing.setMultiInvaders([])}
        />
      )}

      {/* ── Routing map picker ── */}
      {routing.pickerTarget && (
        <MapLocationPicker onCancel={routing.cancelPicker} onValidate={routing.validatePicker} />
      )}

      {/* ── Modify-invader: location picker ── */}
      {picking && (
        <MapLocationPicker onCancel={cancelPicking} onValidate={validatePicking} />
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
    zIndex: ZIndex.control,
  },
  filterBar: {
    position: "absolute",
    bottom: Spacing.five,
    left: Spacing.three,
    zIndex: ZIndex.control,
  },
  offlineBanner: {
    position: "absolute",
    top: Spacing.three,
    alignSelf: "center",
    backgroundColor: Overlay.scrim,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.pill,
    zIndex: ZIndex.overlay,
  },
  offlineText: {
    color: White,
    fontSize: FontSize.sm,
  },
  routingLoader: {
    position: "absolute",
    bottom: BottomTabInset + Spacing.three,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Brand.cyan,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: BorderRadius.pill,
    zIndex: ZIndex.overlay,
  },
  routingLoaderText: {
    color: White,
    fontSize: FontSize.sm,
    fontFamily: AppFont,
  },
  routingFAB: {
    position: "absolute",
    bottom: 140,
    left: Spacing.three,
    width: 54,
    height: 54,
    zIndex: ZIndex.map,
  },
  locateButton: {
    position: "absolute",
    bottom: Spacing.five,
    right: Spacing.three,
    width: 48,
    height: 48,
    zIndex: ZIndex.control,
  },
  compassButton: {
    position: "absolute",
    bottom: 86, // 32 + 48 + 6 — same vertical gap (6) as between the filter buttons
    right: Spacing.three,
    width: 48,
    height: 48,
    zIndex: ZIndex.control,
  },
  newsButton: {
    position: "absolute",
    right: Spacing.three,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    zIndex: ZIndex.control,
  },
  newsBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  newsBadgeText: {
    color: White,
    fontSize: 10,
    fontWeight: "700",
  },
});

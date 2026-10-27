import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { isAxiosError } from "axios";
import { apiErrorDetail } from "@/services/api-client";
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
import { MapLocationPicker, PICKER_BAR_HEIGHT } from "@/features/map/components/MapLocationPicker";
import { CreateHerePopup } from "@/features/map/components/CreateHerePopup";
import { MissingLocationList } from "@/features/map/components/MissingLocationList";
import { FloatingText, useFloatingText } from "@/components/FloatingText";
import { useMapRouting } from "@/features/map/hooks/use-map-routing";
import { useMapCreateFlow } from "@/features/map/hooks/use-map-create-flow";
import { useHeadingStore, usePickerChromeStore, PICK_RETURN_ROUTES, type PickReturnTarget } from "@/features/map/store";
import { MapZoom } from "@/features/map/constants";
import { useNewsUnreadCount } from "@/features/news";
import { useFriendsStore, applyFriendView, FriendMapPicker, FriendMapBanner } from "@/features/friends";
import { useInvaderData, mapInvadersWithProgress } from "@/features/invaders";
import type { InvaderWithState } from "@/features/invaders";
import { useAuthStore, useRequireAccount, GUEST_USER_ID } from "@/features/auth";
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
  // Long-press → "add a location to an existing invader" list
  const [missingListOpen, setMissingListOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const requireAccount = useRequireAccount();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const newsUnread = useNewsUnreadCount();
  const mapRef = useRef<WebMapHandle>(null);

  // Self-contained flows (routing / create-invader / toast) live in their own hooks.
  const routing = useMapRouting(mapRef);
  const create = useMapCreateFlow(mapRef);
  const toast = useFloatingText(Motion.floatTextLong);

  const pendingInvaderId = useLocateStore((s) => s.pendingInvaderId);
  const pickForList = useLocateStore((s) => s.pickForList);
  const setPickForList = useLocateStore((s) => s.setPickForList);
  const setPickedForList = useLocateStore((s) => s.setPickedForList);
  // The current location pick was started from a list: hand the result back there
  const pickReturnRef = useRef<PickReturnTarget | null>(null);
  // The pick comes from a missing location's "+ Add": validating proposes it directly
  const pickSendRef = useRef(false);
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
  // A friend's map / shared map only changes the markers' colors (and what the
  // flashed filter means); taps resolve back to my own invader for the popup.
  const friendMapView = useFriendsStore((s) => s.mapView);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const filteredInvaders = useMemo(
    () => applyMapFilter(applyFriendView(invadersWithState, friendMapView), filter),
    [invadersWithState, friendMapView, filter],
  );
  const ownInvadersById = useMemo(
    () => new Map(invadersWithState.map((i) => [i.id, i])),
    [invadersWithState],
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

  // "+ Add" location from the list: open the picker straight away (same focus rule as above)
  useFocusEffect(
    useCallback(() => {
      if (pickForList == null) return;
      const inv = invadersWithState.find((i) => i.id === pickForList.invaderId);
      if (!inv) return;
      setPickForList(null);
      pickReturnRef.current = pickForList.target;
      pickSendRef.current = !!pickForList.send;
      startPickingLocation(inv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickForList, invadersWithState]),
  );

  // Cancel any pending locate re-assert on unmount.
  useEffect(() => () => { if (locateTimerRef.current) clearTimeout(locateTimerRef.current); }, []);

  function centerOnInvader(invader: InvaderWithState, height: number, zoomLevel?: number) {
    if (invader.latitude == null || invader.longitude == null) return;
    mapRef.current?.centerOn(invader.latitude, invader.longitude, height / 2, zoomLevel);
  }

  const { sheetOpen: routingSheetOpen, toggleInvaderSelection } = routing;
  const creatingActive = create.anyActive;
  const handleInvaderClick = useCallback((tapped: InvaderWithState) => {
    const invader = ownInvadersById.get(tapped.id) ?? tapped;
    if (routingSheetOpen) { toggleInvaderSelection(invader); return; }
    if (picking || creatingActive) return;
    selectedInvaderRef.current = invader;
    setSelectedInvader(invader);
  }, [ownInvadersById, routingSheetOpen, toggleInvaderSelection, picking, creatingActive]);

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
    const uid = user?.id ?? (isGuest ? GUEST_USER_ID : null);
    if (uid == null) return;
    const capture = await flash(uid, invader.id);
    hapticSuccess();
    selectInvader({ ...invader, isCaptured: true, capturedAt: capture.found_at, progressId: capture.id });
  }

  async function handleUnflash(invader: InvaderWithState) {
    if (!invader.progressId) return;
    const removed = await unflash(invader.progressId);
    if (!removed) return; // stale progressId — the dataset effect will refresh the popup
    hapticDisappoint();
    selectInvader({ ...invader, isCaptured: false, capturedAt: undefined, progressId: undefined });
  }

  // ── Modify-invader location picker ────────────────────────────────────────
  async function startPickingLocation(invader: InvaderWithState, send?: boolean) {
    if (send !== undefined) pickSendRef.current = send;
    // Start from the proposal in progress, else the known location; an invader
    // without one (in the list, not on the map) starts right where the map was left.
    const pending = pendingCoords?.invaderId === invader.id ? { lat: pendingCoords.lat, lon: pendingCoords.lon } : null;
    const known = invader.latitude != null && invader.longitude != null
      ? { lat: invader.latitude, lon: invader.longitude }
      : null;
    let start = pending ?? known;
    if (!start) {
      const c = await mapRef.current?.getCenter();
      if (!c) return;
      start = { lat: c[1], lon: c[0] };
    }
    setSelectedInvader(null);
    selectedInvaderRef.current = null;
    setPicking({ invader, startLat: start.lat, startLon: start.lon });
    // Zoom in only when jumping to the invader; otherwise keep the user's framing.
    mapRef.current?.centerOn(start.lat, start.lon, 0, known && !pending ? MapZoom.detail : undefined);
  }

  async function validatePicking() {
    if (!picking) return;
    hapticTap();
    const c = await mapRef.current?.getCenter();
    const inv = picking.invader;
    setPicking(null);
    const send = pickSendRef.current && c != null;
    pickSendRef.current = false;
    if (send) await proposeLocation(inv, c![1], c![0]);
    const target = pickReturnRef.current;
    if (target) {
      pickReturnRef.current = null;
      if (c) setPickedForList({ invaderId: inv.id, target, lon: c[0], lat: c[1], sent: send });
      router.navigate(PICK_RETURN_ROUTES[target]);
      return;
    }
    if (send) { selectInvader(inv); return; }   // popup back, showing the proposal as sent
    if (c) {
      setPendingCoords({ invaderId: inv.id, lon: c[0], lat: c[1] });
    }
    selectInvader(inv);
  }

  /** "+ Add" a missing location: the picked point is proposed as is, no form. */
  async function proposeLocation(invader: InvaderWithState, lat: number, lon: number) {
    try {
      const req = await submitModifyRequest({ invader_id: invader.id, proposed_latitude: lat, proposed_longitude: lon });
      if (req === null) {
        Alert.alert(t("popup.queuedTitle"), t("popup.queuedBody"));
      } else {
        hapticSuccess();
        toast.show();
      }
    } catch (e) {
      Alert.alert(t("popup.update"), isAxiosError(e) && e.response?.status === 409
        ? t("popup.alreadyPending")
        : apiErrorDetail(e) ?? t("popup.sendFailed"));
    }
  }

  function cancelPicking() {
    if (!picking) return;
    hapticTap();
    pickSendRef.current = false;
    const inv = picking.invader;
    setPicking(null);
    const target = pickReturnRef.current;
    if (target) {
      pickReturnRef.current = null;
      router.navigate(PICK_RETURN_ROUTES[target]);
      return;
    }
    selectInvader(inv);
  }

  // ── Long-press → add a location to an existing invader ─────────────────────
  // The chosen invader opens in its edit form with the pin's spot as proposed position.
  async function placeExistingInvader(invader: InvaderWithState) {
    const c = await mapRef.current?.getCenter();
    setMissingListOpen(false);
    if (!c) return;
    hapticTap();
    create.cancel();
    setPendingCoords({ invaderId: invader.id, lat: c[1], lon: c[0] });
    selectInvader(invader);
  }

  // Shared by every map picker: move onto a typed / pasted position.
  function goToCoords(lat: number, lon: number) {
    setIsFollowing(false);
    mapRef.current?.centerOn(lat, lon, 0, MapZoom.detail);
  }

  const anyCreating = create.anyActive || routing.pickerTarget !== null;
  // Locate / compass buttons move above the pickers' Cancel / Validate bar.
  const pickerBarShown = picking !== null || create.pickLoc !== null || routing.pickerTarget !== null;
  const pickerLift = pickerBarShown ? { transform: [{ translateY: -(PICKER_BAR_HEIGHT + Spacing.two) }] } : null;

  // Pickers take the full screen: no tab bar (the News button is hidden below).
  const setPickerActive = usePickerChromeStore((s) => s.setPickerActive);
  useEffect(() => { setPickerActive(pickerBarShown); }, [pickerBarShown, setPickerActive]);
  useEffect(() => () => setPickerActive(false), [setPickerActive]);

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

      <View style={[styles.locateButton, pickerLift]} pointerEvents="box-none">
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

      <View style={[styles.compassButton, pickerLift]} pointerEvents="box-none">
        <BoussoleIcon
          onPress={() => mapRef.current?.resetNorth()}
          size={48}
          colorCircle={theme.bgElement}
          colorNorth={theme.danger}
          colorSouth={theme.text}
        />
      </View>

      {/* News shortcut — top-right, routes to the shared /news screen (hidden while picking) */}
      {!pickerBarShown && (
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
      )}

      {/* Friends' maps — below the News shortcut, account holders only */}
      {user && !isGuest && !picking && !anyCreating && (
        <TouchableOpacity
          style={[styles.newsButton, { top: insets.top + Spacing.two + 48 + 6 }]}
          onPress={() => { hapticTap(); setFriendPickerOpen(true); }}
          activeOpacity={0.8}
        >
          <PixelButton size={48} fill={theme.bgElement} stroke={friendMapView ? theme.accent : theme.border} />
          <MaterialCommunityIcons name="account-group" size={22} color={friendMapView ? theme.accent : theme.textMuted} />
        </TouchableOpacity>
      )}

      {friendMapView && !picking && !anyCreating && (
        <View style={[styles.friendBanner, { top: insets.top + Spacing.two }]}>
          <FriendMapBanner />
        </View>
      )}

      <FriendMapPicker visible={friendPickerOpen} onClose={() => setFriendPickerOpen(false)} />

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

      <FloatingText progress={toast.progress} text={t("map.modificationSent")} size={FontSize.md} style={styles.sentToast} />

      {/* ── Create-invader: initial pin + "create here" card ── */}
      {create.pickerOpen && (
        <CreateHerePopup
          onCreate={() => requireAccount(create.openModal)}
          onAddLocation={() => requireAccount(() => setMissingListOpen(true))}
          onCancel={create.cancel}
        />
      )}

      {/* ── Long-press: pick an existing invader that has no position yet ── */}
      <MissingLocationList
        visible={missingListOpen}
        invaders={invadersWithState}
        onSelect={placeExistingInvader}
        onClose={() => setMissingListOpen(false)}
      />

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
        <MapLocationPicker onCancel={create.cancelPickLoc} onValidate={create.validatePickLoc} onGoTo={goToCoords} />
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
        <MapLocationPicker onCancel={routing.cancelPicker} onValidate={routing.validatePicker} onGoTo={goToCoords} />
      )}

      {/* ── Modify-invader: location picker ── */}
      {picking && (
        <MapLocationPicker onCancel={cancelPicking} onValidate={validatePicking} onGoTo={goToCoords} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // "Modification sent": floats up from above the tab bar, centred
  sentToast: { bottom: 40, left: 0, right: 0, zIndex: ZIndex.overlay },
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
    zIndex: ZIndex.map,
  },
  compassButton: {
    position: "absolute",
    bottom: 86, // 32 + 48 + 6 — same vertical gap (6) as between the filter buttons
    right: Spacing.three,
    width: 48,
    height: 48,
    zIndex: ZIndex.map,
  },
  newsButton: {
    position: "absolute",
    right: Spacing.three,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    zIndex: ZIndex.map,
  },
  friendBanner: {
    position: "absolute",
    left: Spacing.three,
    right: Spacing.three + 48 + Spacing.two, // clear of the News / friends buttons
    zIndex: ZIndex.map,
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
    fontSize: FontSize.xxs,
    fontWeight: "700",
  },
});

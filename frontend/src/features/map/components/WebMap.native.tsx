import { useRef, useEffect, forwardRef, useImperativeHandle, memo } from "react";
import type { ReactNode, RefObject } from "react";
import { StyleSheet, View } from "react-native";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import { MapView, Camera, Images, Logger } from "@maplibre/maplibre-react-native";
import type { CameraRef, MapViewRef } from "@maplibre/maplibre-react-native";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";
import { useInvaderGeojson } from "../hooks/use-invader-geojson";
import { useUserLocation } from "../hooks/use-user-location";
import { InvaderClusterSource } from "./InvaderClusterSource";
import { UserLocationLayer } from "./UserLocationLayer";
import { useReactivatedIds } from "@/features/reactivations";
import { useMarkerImages, useMarkerImagesVersion } from "./invader-markers";
import { ISSMarker } from "@/features/iss/components/ISSMarker";
import { ISS_INVADER_NAME } from "@/features/iss/constants";
import { useHuntPosition } from "@/features/hunt/hooks/use-hunt-position";
import type { PreparedRoute } from "@/features/hunt/route-snap";
import {
  DEFAULT_CENTER, MapZoom, MapAnim, FOLLOW_INTERVAL_MS, CENTER_PADDING_FACTOR,
  HUNT_INTERVAL_MS, HUNT_PITCH, HUNT_TOP_PADDING_RATIO,
} from "../constants";
import { resolveMapStyle } from "../styles";
import { useAppearanceStore } from "@/features/settings";

// Suppress noisy "Canceled" warnings from MapLibre
Logger.setLogCallback((log) => {
  if (log.tag === "Mbgl-HttpRequest" && log.message.startsWith("Request failed due to a permanent error: Canceled")) {
    return true;
  }
  return false;
});

const StableCamera = memo(function StableCamera({ cameraRef }: { cameraRef: RefObject<CameraRef | null> }) {
  useEffect(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: DEFAULT_CENTER,
      zoomLevel: MapZoom.initial,
      animationDuration: MapAnim.none,
    });
    // Release camera after initial set (same pattern as centerOn/centerOnUser)
    const t = setTimeout(() => cameraRef.current?.setCamera({}), MapAnim.initialReleaseDelay);
    return () => clearTimeout(t);
  }, [cameraRef]);

  return <Camera ref={cameraRef} />;
});

export type WebMapHandle = {
  centerOn: (lat: number, lon: number, offsetY: number, zoomLevel?: number) => void;
  centerOnUser: () => void;
  getCenter: () => Promise<[number, number] | null>;
  resetNorth: () => void;
  getUserCoords: () => [number, number] | null;
};

type Props = {
  invaders: InvaderWithState[];
  onInvaderClick: (invader: InvaderWithState) => void;
  onLongPress?: (lat: number, lon: number) => void;
  /** Tap on the map itself (not on a marker). */
  onMapPress?: () => void;
  isFollowing?: boolean;
  headingAlpha?: number;
  onHeadingChange?: (heading: number) => void;
  greyMode?: import("../filter").GreyMode;
  colorMode?: import("../filter").ColorMode;
  highlightedIds?: number[];
  /** Rendered before invader markers — use for route/path layers. */
  routeLayer?: ReactNode;
  /** Hunt view: the route to follow (null = off). Tilted camera behind the user, dot glued to the route. */
  huntRoute?: PreparedRoute | null;
  /** Hunt view: the camera stops following (the user moved the map). */
  huntPaused?: boolean;
  /** The user moved the map by hand during the hunt view. */
  onHuntInterrupt?: () => void;
  children?: ReactNode;
};

const WebMap = forwardRef<WebMapHandle, Props>(function WebMap({ invaders, onInvaderClick, onLongPress, onMapPress, isFollowing = false, headingAlpha, onHeadingChange, greyMode = "none", colorMode = "flash", highlightedIds, routeLayer, huntRoute = null, huntPaused = false, onHuntInterrupt, children }, ref) {
  const cameraRef     = useRef<CameraRef>(null);
  const mapViewRef    = useRef<MapViewRef>(null);
  const userCoordsRef = useRef<[number, number] | null>(null);
  const mapSizeRef    = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const { themeName } = useTheme();
  const mapPoiEnabled   = useAppearanceStore((s) => s.mapPoiEnabled);
  const mapLiteEnabled  = useAppearanceStore((s) => s.mapLiteEnabled);
  const map3dBuildings  = useAppearanceStore((s) => s.map3dBuildingsEnabled);
  // Lite is a minimal map — POIs and 3D buildings are always off there.
  const mapStyle = resolveMapStyle(themeName, {
    showPoi: mapLiteEnabled ? false : mapPoiEnabled,
    lite: mapLiteEnabled,
    show3d: mapLiteEnabled ? false : map3dBuildings,
  });
  const reactivatedIds = useReactivatedIds();
  const geojson       = useInvaderGeojson(invaders, greyMode, colorMode, highlightedIds, reactivatedIds);
  const rawLocation   = useUserLocation(headingAlpha);
  // While hunting: snapped onto the route and facing its direction
  const userLocation  = useHuntPosition(rawLocation, huntRoute);
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const hunting = huntRoute !== null;
  const issInvader    = invaders.find((i) => i.name === ISS_INVADER_NAME);
  const markerImages  = useMarkerImages();
  const markerImagesVersion = useMarkerImagesVersion();

  userCoordsRef.current = rawLocation?.coords ?? null;

  // Follow mode: update camera every 300ms toward user position
  useEffect(() => {
    if (!isFollowing) return;
    const camera = cameraRef.current;

    // Center immediately on enable
    if (userCoordsRef.current) {
      const [lon, lat] = userCoordsRef.current;
      camera?.setCamera({ centerCoordinate: [lon, lat], animationDuration: MapAnim.follow });
    }

    const interval = setInterval(() => {
      if (!userCoordsRef.current) return;
      const [lon, lat] = userCoordsRef.current;
      // linearTo: default "easeTo" decelerates to a stop every tick, which reads as a
      // stutter once the user is actually moving. Constant-velocity interpolation lets
      // consecutive 300ms steps blend into one continuous pan instead.
      camera?.setCamera({ centerCoordinate: [lon, lat], animationDuration: MapAnim.follow, animationMode: "linearTo" });
    }, FOLLOW_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      camera?.setCamera({});
    };
  }, [isFollowing]);

  // Hunt view: tilted camera behind the user, turned the way the route goes. Each step
  // starts before the previous one ends (linearTo), so they blend into one movement.
  useEffect(() => {
    if (!hunting || huntPaused) return;
    const camera = cameraRef.current;
    const step = (animationDuration: number) => {
      const loc = userLocationRef.current;
      if (!loc) return;
      camera?.setCamera({
        centerCoordinate: loc.coords,
        ...(loc.heading !== null && { heading: loc.heading }),
        pitch: HUNT_PITCH,
        zoomLevel: MapZoom.hunt,
        padding: { paddingTop: mapSizeRef.current.height * HUNT_TOP_PADDING_RATIO, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
        animationDuration,
        animationMode: animationDuration === MapAnim.hunt ? "linearTo" : "easeTo",
      });
    };
    step(MapAnim.huntEnter);
    let interval: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => step(MapAnim.hunt), HUNT_INTERVAL_MS);
    }, MapAnim.huntEnter);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
      camera?.setCamera({});
    };
  }, [hunting, huntPaused]);

  // Hunt view: dragging, pinching or rotating the map unlocks the camera (Recenter
  // locks it again). Watched on the raw touches: the map's isUserInteraction flag
  // misses gestures while the following camera keeps moving, so the map could not
  // be moved at all. A tap (tiny move) doesn't count.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: GestureResponderEvent) => {
    touchStartRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    if (!hunting || huntPaused) return;
    const n = e.nativeEvent;
    const start = touchStartRef.current;
    const dragged = start !== null && Math.hypot(n.pageX - start.x, n.pageY - start.y) > HUNT_DRAG_THRESHOLD_PX;
    if (n.touches.length > 1 || dragged) onHuntInterrupt?.();
  };

  // Leaving the hunt view: back to the flat, north-up map around the same spot
  const wasHunting = useRef(false);
  useEffect(() => {
    if (hunting) { wasHunting.current = true; return; }
    if (!wasHunting.current) return;
    wasHunting.current = false;
    cameraRef.current?.setCamera({
      pitch: 0,
      heading: 0,
      padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
      animationDuration: MapAnim.recenter,
    });
    const t = setTimeout(() => cameraRef.current?.setCamera({}), MapAnim.releaseDelay);
    return () => clearTimeout(t);
  }, [hunting]);

  useImperativeHandle(ref, () => ({
    centerOn: (lat, lon, offsetY, zoomLevel) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        ...(zoomLevel !== undefined && { zoomLevel }),
        padding: { paddingTop: offsetY * CENTER_PADDING_FACTOR, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
        animationDuration: MapAnim.recenter,
      });
      setTimeout(() => cameraRef.current?.setCamera({}), MapAnim.releaseDelay);
    },
    centerOnUser: () => {
      if (!userCoordsRef.current) return;
      const [lon, lat] = userCoordsRef.current;
      cameraRef.current?.setCamera({ centerCoordinate: [lon, lat], zoomLevel: MapZoom.user, animationDuration: MapAnim.recenter });
      setTimeout(() => cameraRef.current?.setCamera({}), MapAnim.releaseDelay);
    },
    getCenter: async () => {
      const { width, height } = mapSizeRef.current;
      const c = await mapViewRef.current?.getCoordinateFromView([width / 2, height / 2]);
      if (!c) return null;
      return [c[0], c[1]] as [number, number];
    },
    resetNorth: () => {
      cameraRef.current?.setCamera({ heading: 0, animationDuration: MapAnim.recenter });
      setTimeout(() => cameraRef.current?.setCamera({}), MapAnim.releaseDelay);
    },
    getUserCoords: () => userCoordsRef.current,
  }), []);

  return (
    <View style={styles.map} onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
    <MapView
      ref={mapViewRef}
      key={themeName}
      style={styles.map}
      mapStyle={mapStyle}
      compassEnabled={false}
      attributionPosition={{ bottom: 8, left: 8 }}
      // MapView forwards onLayout to its wrapping RN View but doesn't type it.
      {...({ onLayout: (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        mapSizeRef.current = { width, height };
      } } as { onLayout?: (e: LayoutChangeEvent) => void })}
      onPress={() => onMapPress?.()}
      onLongPress={(feature) => {
        if (feature.geometry.type !== "Point") return;
        const [lon, lat] = feature.geometry.coordinates;
        onLongPress?.(lat, lon);
      }}
      onRegionIsChanging={(e) => {
        onHeadingChange?.(e.properties.heading);
        if (hunting && !huntPaused && e.properties.isUserInteraction) onHuntInterrupt?.();
      }}
      onRegionDidChange={(e) => onHeadingChange?.(e.properties.heading)}
    >
      <StableCamera cameraRef={cameraRef} />
      {routeLayer}
      <UserLocationLayer location={userLocation} />
      <Images key={markerImagesVersion} images={markerImages} />
      <InvaderClusterSource
        geojson={geojson}
        invaders={invaders}
        cameraRef={cameraRef}
        onInvaderPress={onInvaderClick}
      />
      {issInvader && (
        <ISSMarker
          issInvader={issInvader}
          colorMode={colorMode}
          greyMode={greyMode}
          onPress={onInvaderClick}
        />
      )}
      {children}
    </MapView>
    </View>
  );
});

export default WebMap;

// Finger travel (px) before a touch counts as moving the map in the hunt view
const HUNT_DRAG_THRESHOLD_PX = 10;

const styles = StyleSheet.create({
  map: { flex: 1 },
});

import { useRef, useEffect, forwardRef, useImperativeHandle, memo } from "react";
import type { ReactNode, RefObject } from "react";
import { StyleSheet } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { MapView, Camera, Images, Logger } from "@maplibre/maplibre-react-native";
import type { CameraRef, MapViewRef } from "@maplibre/maplibre-react-native";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";
import { useInvaderGeojson } from "../hooks/use-invader-geojson";
import { useUserLocation } from "../hooks/use-user-location";
import { InvaderClusterSource } from "./InvaderClusterSource";
import { UserLocationLayer } from "./UserLocationLayer";
import { MARKER_IMAGES } from "./invader-markers";
import { ISSMarker } from "@/features/iss/components/ISSMarker";
import { ISS_INVADER_NAME } from "@/features/iss/constants";
import {
  DEFAULT_CENTER, MapZoom, MapAnim, FOLLOW_INTERVAL_MS, CENTER_PADDING_FACTOR,
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
  isFollowing?: boolean;
  headingAlpha?: number;
  onHeadingChange?: (heading: number) => void;
  greyMode?: import("../filter").GreyMode;
  colorMode?: import("../filter").ColorMode;
  highlightedIds?: number[];
  /** Rendered before invader markers — use for route/path layers. */
  routeLayer?: ReactNode;
  children?: ReactNode;
};

const WebMap = forwardRef<WebMapHandle, Props>(function WebMap({ invaders, onInvaderClick, onLongPress, isFollowing = false, headingAlpha, onHeadingChange, greyMode = "none", colorMode = "flash", highlightedIds, routeLayer, children }, ref) {
  const cameraRef     = useRef<CameraRef>(null);
  const mapViewRef    = useRef<MapViewRef>(null);
  const userCoordsRef = useRef<[number, number] | null>(null);
  const mapSizeRef    = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const { themeName } = useTheme();
  const mapPoiEnabled  = useAppearanceStore((s) => s.mapPoiEnabled);
  const mapLiteEnabled = useAppearanceStore((s) => s.mapLiteEnabled);
  const mapStyle       = resolveMapStyle(themeName, { showPoi: mapPoiEnabled, lite: mapLiteEnabled });
  const geojson       = useInvaderGeojson(invaders, greyMode, colorMode, highlightedIds);
  const userLocation  = useUserLocation(headingAlpha);
  const issInvader    = invaders.find((i) => i.name === ISS_INVADER_NAME);

  userCoordsRef.current = userLocation?.coords ?? null;

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
      camera?.setCamera({ centerCoordinate: [lon, lat], animationDuration: MapAnim.follow });
    }, FOLLOW_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      camera?.setCamera({});
    };
  }, [isFollowing]);

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
      onLongPress={(feature) => {
        if (feature.geometry.type !== "Point") return;
        const [lon, lat] = feature.geometry.coordinates;
        onLongPress?.(lat, lon);
      }}
      onRegionIsChanging={(e) => onHeadingChange?.(e.properties.heading)}
      onRegionDidChange={(e) => onHeadingChange?.(e.properties.heading)}
    >
      <StableCamera cameraRef={cameraRef} />
      {routeLayer}
      <UserLocationLayer location={userLocation} />
      <Images images={MARKER_IMAGES} />
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
  );
});

export default WebMap;

const styles = StyleSheet.create({
  map: { flex: 1 },
});

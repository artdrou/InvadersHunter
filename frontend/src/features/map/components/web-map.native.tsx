import { useRef, useEffect, forwardRef, useImperativeHandle, memo } from "react";
import type { RefObject } from "react";
import { StyleSheet } from "react-native";
import { MapView, Camera, Images, Logger } from "@maplibre/maplibre-react-native";
import type { CameraRef, MapViewRef } from "@maplibre/maplibre-react-native";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";
import { useInvaderGeojson } from "../hooks/use-invader-geojson";
import { useUserLocation } from "../hooks/use-user-location";
import { InvaderClusterSource } from "./invader-cluster-source";
import { UserLocationLayer } from "./user-location-layer";
import { MARKER_IMAGES } from "./invader-markers";

// Suppress noisy "Canceled" warnings from MapLibre
Logger.setLogCallback((log) => {
  if (log.tag === "Mbgl-HttpRequest" && log.message.startsWith("Request failed due to a permanent error: Canceled")) {
    return true;
  }
  return false;
});

const MAP_STYLES: Record<string, string> = {
  dark:  "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
  blue:  "https://api.maptiler.com/maps/019d4e3d-65da-75e0-8ed5-e0c944618e3a/style.json?key=boZ0TjiM2vOJbp9YnFsp",
};

const StableCamera = memo(function StableCamera({ cameraRef }: { cameraRef: RefObject<CameraRef | null> }) {
  useEffect(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: [2.3522, 48.8566],
      zoomLevel: 12,
      animationDuration: 0,
    });
    // Release camera after initial set (same pattern as centerOn/centerOnUser)
    const t = setTimeout(() => cameraRef.current?.setCamera({}), 100);
    return () => clearTimeout(t);
  }, []);

  return <Camera ref={cameraRef} />;
});

export type WebMapHandle = {
  centerOn: (lat: number, lon: number, offsetY: number, zoomLevel?: number) => void;
  centerOnUser: () => void;
  getCenter: () => Promise<[number, number] | null>;
};

type Props = {
  invaders: InvaderWithState[];
  onInvaderClick: (invader: InvaderWithState) => void;
  onLongPress?: (lat: number, lon: number) => void;
  isFollowing?: boolean;
  headingAlpha?: number;
};

const WebMap = forwardRef<WebMapHandle, Props>(function WebMap({ invaders, onInvaderClick, onLongPress, isFollowing = false, headingAlpha }, ref) {
  const cameraRef     = useRef<CameraRef>(null);
  const mapViewRef    = useRef<MapViewRef>(null);
  const userCoordsRef = useRef<[number, number] | null>(null);
  const { themeName } = useTheme();
  const mapStyle      = MAP_STYLES[themeName] ?? MAP_STYLES.dark;
  const geojson       = useInvaderGeojson(invaders);
  const userLocation  = useUserLocation(headingAlpha);

  userCoordsRef.current = userLocation?.coords ?? null;

  // Follow mode: update camera every 300ms toward user position
  useEffect(() => {
    if (!isFollowing) return;

    // Center immediately on enable
    if (userCoordsRef.current) {
      const [lon, lat] = userCoordsRef.current;
      cameraRef.current?.setCamera({ centerCoordinate: [lon, lat], animationDuration: 300 });
    }

    const interval = setInterval(() => {
      if (!userCoordsRef.current) return;
      const [lon, lat] = userCoordsRef.current;
      cameraRef.current?.setCamera({ centerCoordinate: [lon, lat], animationDuration: 300 });
    }, 300);

    return () => {
      clearInterval(interval);
      cameraRef.current?.setCamera({});
    };
  }, [isFollowing]);

  useImperativeHandle(ref, () => ({
    centerOn: (lat, lon, offsetY, zoomLevel) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        ...(zoomLevel !== undefined && { zoomLevel }),
        padding: { paddingTop: offsetY * 2.25, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
        animationDuration: 350,
      });
      setTimeout(() => cameraRef.current?.setCamera({}), 450);
    },
    centerOnUser: () => {
      if (!userCoordsRef.current) return;
      const [lon, lat] = userCoordsRef.current;
      cameraRef.current?.setCamera({ centerCoordinate: [lon, lat], zoomLevel: 15, animationDuration: 350 });
      setTimeout(() => cameraRef.current?.setCamera({}), 450);
    },
    getCenter: async () => {
      const c = await mapViewRef.current?.getCenter();
      if (!c) return null;
      return [c[0], c[1]] as [number, number];
    },
  }), []);

  return (
    <MapView
      ref={mapViewRef}
      key={mapStyle}
      style={styles.map}
      mapStyle={mapStyle}
      attributionPosition={{ bottom: 8, left: 8 }}
      onLongPress={(e: any) => {
        const [lon, lat] = e.geometry.coordinates;
        onLongPress?.(lat, lon);
      }}
    >
      <StableCamera cameraRef={cameraRef} />
      <UserLocationLayer location={userLocation} />
      <Images images={MARKER_IMAGES} />
      <InvaderClusterSource
        geojson={geojson}
        invaders={invaders}
        cameraRef={cameraRef}
        onInvaderPress={onInvaderClick}
      />
    </MapView>
  );
});

export default WebMap;

const styles = StyleSheet.create({
  map: { flex: 1 },
});

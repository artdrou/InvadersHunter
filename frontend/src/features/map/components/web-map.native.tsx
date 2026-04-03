import { useRef, forwardRef, useImperativeHandle } from "react";
import { StyleSheet } from "react-native";
import { MapView, Camera, Images, Logger } from "@maplibre/maplibre-react-native";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";
import { useInvaderGeojson } from "../hooks/use-invader-geojson";
import { InvaderClusterSource } from "./invader-cluster-source";

import markerCaptured   from '../../../../assets/images/marker-captured-bloom-x3.png';
import markerUncaptured from '../../../../assets/images/marker-uncaptured-bloom-x2.png';

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

export type WebMapHandle = {
  centerOn: (lat: number, lon: number, offsetY: number) => void;
};

type Props = {
  invaders: InvaderWithState[];
  onInvaderClick: (invader: InvaderWithState) => void;
};

const WebMap = forwardRef<WebMapHandle, Props>(function WebMap({ invaders, onInvaderClick }, ref) {
  const cameraRef = useRef<CameraRef>(null);
  const { themeName } = useTheme();
  const mapStyle = MAP_STYLES[themeName] ?? MAP_STYLES.dark;
  const geojson = useInvaderGeojson(invaders);

  useImperativeHandle(ref, () => ({
    centerOn: (lat, lon, offsetY) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        padding: { paddingTop: offsetY * 2.25, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
        animationDuration: 350,
      });
    },
  }));

  return (
    <MapView key={mapStyle} style={styles.map} mapStyle={mapStyle}>
      <Camera
        ref={cameraRef}
        zoomLevel={12}
        centerCoordinate={[2.3522, 48.8566]}
      />
      <Images
        images={{
          'marker-captured':   markerCaptured,
          'marker-uncaptured': markerUncaptured,
        }}
      />
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

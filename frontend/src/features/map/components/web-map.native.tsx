import { useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { StyleSheet } from "react-native";
import { MapView, Camera, Images, ShapeSource, SymbolLayer, Logger } from "@maplibre/maplibre-react-native";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";

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

const BASE_ICON_SIZE = 0.35;

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

  useImperativeHandle(ref, () => ({
    centerOn: (lat, lon, offsetY) => {
      // paddingTop shifts the effective viewport center DOWN by offsetY pixels,
      // placing the coordinate offsetY pixels below screen center (at the arrow tip).
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        padding: { paddingTop: offsetY * 2.25, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
        animationDuration: 350,
      });
    },
  }));

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: invaders.map((invader) => {
      const size = 0.5 * (invader.points ? Math.min(24, 10 * Math.log10(invader.points)) : 12);
      const iconSize = (size / 12) * BASE_ICON_SIZE;
      return {
        type: "Feature" as const,
        id: String(invader.id),
        geometry: {
          type: "Point" as const,
          coordinates: [invader.longitude, invader.latitude],
        },
        properties: {
          id: invader.id,
          captured: invader.isCaptured ? 1 : 0,
          iconSize,
        },
      };
    }),
  }), [invaders]);

  const handlePress = (e: any) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const invader = invaders.find((i) => i.id === feature.properties?.id);
    if (!invader) return;
    onInvaderClick(invader);
  };

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
      <ShapeSource id="invaders" shape={geojson} onPress={handlePress}>
        <SymbolLayer
          id="invader-markers"
          style={{
            iconImage: ['case', ['==', ['get', 'captured'], 1], 'marker-captured', 'marker-uncaptured'],
            iconSize: ['get', 'iconSize'],
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
          }}
        />
      </ShapeSource>
    </MapView>
  );
});

export default WebMap;

const styles = StyleSheet.create({
  map: { flex: 1 },
});

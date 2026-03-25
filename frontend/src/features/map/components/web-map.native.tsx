import { useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { MapView, Camera, Images, ShapeSource, SymbolLayer, Logger } from "@maplibre/maplibre-react-native";
import type { CameraRef } from "@maplibre/maplibre-react-native";

// Suppress noisy "Canceled" warnings from MapLibre — these are expected when the
// map remounts (e.g. on theme change) and in-flight tile requests get canceled.
Logger.setLogCallback((log) => {
  if (log.tag === "Mbgl-HttpRequest" && log.message.startsWith("Request failed due to a permanent error: Canceled")) {
    return true; // returning true prevents the default console output
  }
  return false;
});
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";

import markerCaptured   from '../../../../assets/images/marker-captured-bloom-x3.png';
import markerUncaptured from '../../../../assets/images/marker-uncaptured-bloom-x2.png';

const MAP_STYLES: Record<string, string> = {
  dark:  "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};

// iconSize = 1.0 means "display at the PNG's native pixel size"
// BASE_ICON_SIZE is the scale for a size-12 marker (no points)
const BASE_ICON_SIZE = 0.35;

type Props = {
  invaders: InvaderWithState[];
  onInvaderClick: (invader: InvaderWithState) => void;
};

export default function WebMap({ invaders, onInvaderClick }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const { themeName } = useTheme();
  const mapStyle = MAP_STYLES[themeName] ?? MAP_STYLES.dark;

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: invaders.map((invader) => {
      const size = invader.points ? Math.min(24, 10 * Math.log10(invader.points)) : 12;
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
    cameraRef.current?.setCamera({
      centerCoordinate: [invader.longitude, invader.latitude],
      animationDuration: 350,
    });
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
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

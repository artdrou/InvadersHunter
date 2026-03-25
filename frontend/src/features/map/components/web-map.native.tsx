import { useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";
import { Brand } from "@/constants/theme";

const MAP_STYLES: Record<string, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

type Props = {
  invaders: InvaderWithState[];
  onInvaderClick: (invader: InvaderWithState) => void;
};

export default function WebMap({ invaders, onInvaderClick }: Props) {
  const cameraRef = useRef<MapLibreGL.Camera>(null);
  const { themeName } = useTheme();
  const mapStyle = MAP_STYLES[themeName] ?? MAP_STYLES.dark;

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: invaders.map((invader) => ({
      type: "Feature" as const,
      id: String(invader.id),
      geometry: {
        type: "Point" as const,
        coordinates: [invader.longitude, invader.latitude],
      },
      properties: {
        id: invader.id,
        captured: invader.isCaptured ? 1 : 0,
      },
    })),
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
    <MapLibreGL.MapView key={mapStyle} style={styles.map} mapStyle={mapStyle}>
      <MapLibreGL.Camera
        ref={cameraRef}
        zoomLevel={12}
        centerCoordinate={[2.3522, 48.8566]}
      />
      <MapLibreGL.ShapeSource id="invaders" shape={geojson} onPress={handlePress}>
        <MapLibreGL.CircleLayer
          id="uncaptured"
          filter={["==", ["get", "captured"], 0]}
          style={{
            circleColor: Brand.pink,
            circleRadius: 8,
            circleStrokeWidth: 1.5,
            circleStrokeColor: Brand.uncapturedOutline,
          }}
        />
        <MapLibreGL.CircleLayer
          id="captured"
          filter={["==", ["get", "captured"], 1]}
          style={{
            circleColor: Brand.cyan,
            circleRadius: 8,
            circleStrokeWidth: 1.5,
            circleStrokeColor: Brand.capturedOutline,
          }}
        />
      </MapLibreGL.ShapeSource>
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

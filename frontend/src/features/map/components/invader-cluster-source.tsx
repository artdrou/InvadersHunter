import { ShapeSource, CircleLayer, SymbolLayer } from "@maplibre/maplibre-react-native";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import type { RefObject } from "react";
import type { InvaderWithState } from "@/features/invaders";
import { MARKER_LAYER_STYLE, MARKER_LAYER_FILTER } from "./invader-markers";

// Tune these to control clustering behaviour:
const CLUSTER_RADIUS        = 50;  // px radius to merge nearby points into a cluster
const CLUSTER_MAX_ZOOM      = 10;  // zoom level above which all markers appear individually

type Props = {
  geojson: GeoJSON.FeatureCollection;
  invaders: InvaderWithState[];
  cameraRef: RefObject<CameraRef | null>;
  onInvaderPress: (invader: InvaderWithState) => void;
};

export function InvaderClusterSource({ geojson, invaders, cameraRef, onInvaderPress }: Props) {
  function handlePress(e: any) {
    const feature = e.features?.[0];
    if (!feature) return;

    // Cluster tap → zoom in to expand it
    if (feature.properties?.cluster) {
      const [lon, lat] = feature.geometry.coordinates;
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        zoomLevel: feature.properties.expansion_zoom ?? 14,
        animationDuration: 400,
      });
      setTimeout(() => cameraRef.current?.setCamera({}), 500);
      return;
    }

    // Individual marker tap
    const invader = invaders.find((i) => i.id === feature.properties?.id);
    if (invader) onInvaderPress(invader);
  }

  return (
    <ShapeSource
      id="invaders"
      shape={geojson}
      onPress={handlePress}
      key={`cluster-${CLUSTER_MAX_ZOOM}-${CLUSTER_RADIUS}`}
      cluster
      clusterRadius={CLUSTER_RADIUS}
      clusterMaxZoomLevel={CLUSTER_MAX_ZOOM}
      clusterProperties={{
        // True only if every point in the cluster has captured=1.
        // Used by the cluster bubble to flip from red to blue.
        all_captured: ["all", ["==", ["get", "captured"], 1]],
      }}
    >
      {/* Soft bloom halo behind the cluster bubble — purple for red bubbles,
          Klein blue for blue bubbles. Declared before the main bubble so it
          renders underneath. circleBlur softens the edge into a glow. */}
      <CircleLayer
        id="cluster-halo"
        filter={["has", "point_count"]}
        style={{
          circleRadius: [
            "step", ["get", "point_count"],
            28,        // 1-9   (bubble 18 + 10 halo)
            10, 34,    // 10-49
            50, 42,    // 50-199
            200, 50,   // 200+
          ],
          circleColor: [
            "case",
            ["get", "all_captured"],
            "#002fa7",  // International Klein Blue
            "#a300b3",  // purple-magenta
          ],
          circleOpacity: 0.45,
          circleBlur: 0.6,
        }}
      />

      {/* Cluster bubble — colour matches the marker tone (red by default, blue
          when every point in the cluster is captured). Radius still grows with
          cluster size so denser areas read as bigger bubbles. */}
      <CircleLayer
        id="cluster-circle"
        filter={["has", "point_count"]}
        style={{
          circleRadius: [
            "step", ["get", "point_count"],
            18,        // 1-9
            10, 22,    // 10-49
            50, 28,    // 50-199
            200, 34,   // 200+
          ],
          circleColor: [
            "case",
            ["get", "all_captured"],
            "#1cf0ff",  // every point captured → blue (matches captured marker)
            "#ff0062",  // otherwise → red-pink (matches uncaptured marker)
          ],
          circleOpacity: 0.95,
        }}
      />

      {/* Cluster count label */}
      <SymbolLayer
        id="cluster-count"
        filter={["has", "point_count"]}
        style={{
          textField: "{point_count_abbreviated}",
          textSize: 13,
          textColor: "#ffffff",
          textFont: ["Noto Sans Bold"],
          textAllowOverlap: true,
        }}
      />

      <SymbolLayer
        id="invader-markers"
        filter={MARKER_LAYER_FILTER}
        style={MARKER_LAYER_STYLE}
      />
    </ShapeSource>
  );
}

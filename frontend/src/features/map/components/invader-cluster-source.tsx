import { ShapeSource, CircleLayer, SymbolLayer } from "@maplibre/maplibre-react-native";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import type { RefObject } from "react";
import type { InvaderWithState } from "@/features/invaders";
import { MARKER_LAYER_STYLE, MARKER_LAYER_FILTER } from "./invader-markers";

// Tune these to control clustering behaviour:
const CLUSTER_RADIUS        = 50;  // px radius to merge nearby points into a cluster
const CLUSTER_MAX_ZOOM      = 12;  // zoom level above which all markers appear individually

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
    >
      {/* Cluster bubble */}
      <CircleLayer
        id="cluster-circle"
        filter={["has", "point_count"]}
        style={{
          circleRadius: ["step", ["get", "point_count"], 20, 50, 28, 200, 36],
          circleColor: ["step", ["get", "point_count"], "#ff0062", 50, "#ffd000", 200, "#13f2fa"],
          circleOpacity: 0.85,
          circleStrokeWidth: 2,
          circleStrokeColor: "#090e3f33",
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

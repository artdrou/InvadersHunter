import { ShapeSource, CircleLayer, SymbolLayer } from "@maplibre/maplibre-react-native";
import type { CameraRef, OnPressEvent } from "@maplibre/maplibre-react-native";
import type { RefObject } from "react";
import type { InvaderWithState } from "@/features/invaders";
import { useAppearanceStore } from "@/features/settings";
import { White } from "@/constants/theme";
import { MapZoom, MapAnim } from "../constants";
import { MARKER_LAYER_STYLE, MARKER_LAYER_FILTER } from "./invader-markers";

// px radius to merge nearby points into a cluster. The clustering on/off toggle
// and the zoom threshold (above which all markers appear individually) live in
// the appearance settings store.
const CLUSTER_RADIUS = 50;

// Cluster bubble paint colors (kept named, not inline — see CONVENTIONS.md).
const ClusterColor = {
  haloCaptured: "#002fa7",   // International Klein Blue (all points captured)
  haloDefault: "#a300b3",    // purple-magenta bloom
  bubbleCaptured: "#1cf0ff", // captured → blue (matches captured marker)
  bubbleDefault: "#ff0062",  // otherwise → red-pink (matches uncaptured marker)
} as const;

type Props = {
  geojson: GeoJSON.FeatureCollection;
  invaders: InvaderWithState[];
  cameraRef: RefObject<CameraRef | null>;
  onInvaderPress: (invader: InvaderWithState) => void;
};

export function InvaderClusterSource({ geojson, invaders, cameraRef, onInvaderPress }: Props) {
  const clusteringEnabled = useAppearanceStore((s) => s.clusteringEnabled);
  const clusterMaxZoom    = useAppearanceStore((s) => s.clusterMaxZoom);
  function handlePress(e: OnPressEvent) {
    const feature = e.features?.[0];
    if (!feature) return;

    // Cluster tap → zoom in to expand it
    if (feature.properties?.cluster && feature.geometry.type === "Point") {
      const [lon, lat] = feature.geometry.coordinates;
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        zoomLevel: feature.properties?.expansion_zoom ?? MapZoom.clusterExpandFallback,
        animationDuration: MapAnim.clusterExpand,
      });
      setTimeout(() => cameraRef.current?.setCamera({}), MapAnim.releaseDelay);
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
      key={`cluster-${clusteringEnabled ? clusterMaxZoom : "off"}-${CLUSTER_RADIUS}`}
      cluster={clusteringEnabled}
      clusterRadius={CLUSTER_RADIUS}
      clusterMaxZoomLevel={clusterMaxZoom}
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
            ClusterColor.haloCaptured,
            ClusterColor.haloDefault,
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
            ClusterColor.bubbleCaptured,
            ClusterColor.bubbleDefault,
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
          textColor: White,
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

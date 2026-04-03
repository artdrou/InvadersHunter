import markerCaptured   from '../../../../assets/images/marker-captured-bloom-x3.png';
import markerUncaptured from '../../../../assets/images/marker-uncaptured-bloom-x2.png';

/**
 * Image assets to pass to <Images images={MARKER_IMAGES} /> in MapView.
 * MapLibre requires <Images> to be a direct child of <MapView>.
 */
export const MARKER_IMAGES = {
  'marker-captured':   markerCaptured,
  'marker-uncaptured': markerUncaptured,
};

/**
 * Style for the individual (non-clustered) marker SymbolLayer.
 * Used directly inside <ShapeSource> in invader-cluster-source.tsx.
 * MapLibre requires layers to be direct children of their source.
 */
export const MARKER_LAYER_STYLE = {
  iconImage: ["case", ["==", ["get", "captured"], 1], "marker-captured", "marker-uncaptured"],
  iconSize: ["get", "iconSize"],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
} as const;

export const MARKER_LAYER_FILTER = ["!", ["has", "point_count"]] as const;

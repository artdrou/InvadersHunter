import { ShapeSource, CircleLayer, FillLayer } from "@maplibre/maplibre-react-native";
import type { UserLocation } from "../hooks/use-user-location";

const CONE_RADIUS_METERS = 80;
const CONE_SPREAD_DEG    = 50;

function buildCone(center: [number, number], headingDeg: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lon, lat] = center;
  const latRad = (lat * Math.PI) / 180;

  const metersToLat = 1 / 111320;
  const metersToLon = 1 / (111320 * Math.cos(latRad));

  const startAngle = headingDeg - CONE_SPREAD_DEG / 2;
  const endAngle   = headingDeg + CONE_SPREAD_DEG / 2;
  const steps = 12;

  const ring: [number, number][] = [[lon, lat]];
  for (let i = 0; i <= steps; i++) {
    const angle    = startAngle + (endAngle - startAngle) * (i / steps);
    const angleRad = (angle * Math.PI) / 180;
    ring.push([
      lon + Math.sin(angleRad) * CONE_RADIUS_METERS * metersToLon,
      lat + Math.cos(angleRad) * CONE_RADIUS_METERS * metersToLat,
    ]);
  }
  ring.push([lon, lat]);

  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
}

type Props = { location: UserLocation | null };

export function UserLocationLayer({ location }: Props) {
  const coords: [number, number] = location?.coords ?? [0, 0];
  const heading = location?.heading ?? null;

  const dotGeojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: location ? [{ type: "Feature", geometry: { type: "Point", coordinates: coords }, properties: {} }] : [],
  };

  const coneGeojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: location && heading !== null ? [buildCone(coords, heading)] : [],
  };

  return (
    <>
      {/* Heading cone */}
      <ShapeSource id="user-heading" shape={coneGeojson}>
        <FillLayer
          id="user-heading-fill"
          style={{ fillColor: "#4a90e2", fillOpacity: 0.25 }}
        />
      </ShapeSource>

      {/* Position dot */}
      <ShapeSource id="user-location" shape={dotGeojson}>
        <CircleLayer
          id="user-location-dot"
          style={{
            circleRadius: 8,
            circleColor: "#4a90e2",
            circleStrokeWidth: 2,
            circleStrokeColor: "#ffffff",
          }}
        />
      </ShapeSource>
    </>
  );
}

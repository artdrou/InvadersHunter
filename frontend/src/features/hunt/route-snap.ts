// Route snapping for the hunt view. Pure logic (no Expo imports) so it can be unit-tested.
//
// The route is projected once into local metres around its first point (equirectangular:
// exact enough over a few km). Each position is then projected onto the nearest segment,
// searching around the previous match first so a loop route never jumps to a parallel part.
import type { FeatureCollection, Position } from 'geojson';

type LonLat = [number, number];

const METERS_PER_DEG_LAT = 111_320;
/** Beyond this distance from the route, the dot follows the real GPS position. */
export const HUNT_SNAP_MAX_M = 25;
/** Window searched around the previous match (metres behind / ahead along the route). */
const SEARCH_BEHIND_M = 50;
const SEARCH_AHEAD_M = 150;
/** The camera aims at the point this far ahead, so it turns before corners. */
const LOOK_AHEAD_M = 15;

export type PreparedRoute = {
  coords: LonLat[];
  /** Vertices in local metres (east, north) around coords[0]. */
  xy: LonLat[];
  /** Distance along the route at each vertex (m). */
  cum: number[];
  total: number;
  mLon: number;
};

export type SnapResult = {
  snapped: LonLat;
  /** Segment from vertex i to i + 1. */
  segmentIndex: number;
  /** Distance between the position and the route (m). */
  offRouteM: number;
  /** Distance along the route to the snapped point (m): pass it back as the next hint. */
  alongM: number;
};

/** The walking line of an ORS directions response (LineString segments joined). */
export function extractRouteLine(fc: FeatureCollection | null | undefined): LonLat[] {
  const line: LonLat[] = [];
  const push = (points: Position[]) => {
    for (const [lon, lat] of points) {
      const last = line[line.length - 1];
      if (!last || last[0] !== lon || last[1] !== lat) line.push([lon, lat]);
    }
  };
  for (const feature of fc?.features ?? []) {
    const g = feature.geometry;
    if (g?.type === 'LineString') push(g.coordinates);
    else if (g?.type === 'MultiLineString') g.coordinates.forEach(push);
  }
  return line;
}

export function prepareRoute(coords: LonLat[]): PreparedRoute | null {
  if (coords.length < 2) return null;
  const [lon0, lat0] = coords[0];
  const mLon = METERS_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const xy = coords.map(([lon, lat]) => [(lon - lon0) * mLon, (lat - lat0) * METERS_PER_DEG_LAT] as LonLat);
  const cum = [0];
  for (let i = 1; i < xy.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
  }
  return { coords, xy, cum, total: cum[cum.length - 1], mLon };
}

function toXY(route: PreparedRoute, [lon, lat]: LonLat): LonLat {
  return [(lon - route.coords[0][0]) * route.mLon, (lat - route.coords[0][1]) * METERS_PER_DEG_LAT];
}

function toLonLat(route: PreparedRoute, [x, y]: LonLat): LonLat {
  return [route.coords[0][0] + x / route.mLon, route.coords[0][1] + y / METERS_PER_DEG_LAT];
}

/**
 * Closest point of segment i to p, keeping only the part of the segment between
 * minAlong and maxAlong (metres along the route): [distance², t in 0..1].
 */
function projectOnSegment(route: PreparedRoute, i: number, [px, py]: LonLat, minAlong: number, maxAlong: number): [number, number] {
  const [ax, ay] = route.xy[i];
  const [bx, by] = route.xy[i + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2);
  const tMin = len === 0 ? 0 : Math.max(0, (minAlong - route.cum[i]) / len);
  const tMax = len === 0 ? 0 : Math.min(1, (maxAlong - route.cum[i]) / len);
  const t = len2 === 0 ? 0 : Math.min(tMax, Math.max(tMin, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return [cx * cx + cy * cy, t];
}

function nearestIn(route: PreparedRoute, p: LonLat, minAlong: number, maxAlong: number) {
  let best = { i: 0, d2: Infinity, t: 0 };
  for (let i = 0; i < route.xy.length - 1; i++) {
    if (route.cum[i + 1] < minAlong || route.cum[i] > maxAlong) continue;
    const [d2, t] = projectOnSegment(route, i, p, minAlong, maxAlong);
    if (d2 < best.d2) best = { i, d2, t };
  }
  return best;
}

/**
 * Projects a position onto the route. With a hint (the previous alongM), only the
 * stretch around it is searched, so the dot never jumps to a nearby part of the route
 * walked earlier or later; the whole route is searched when that stretch is too far
 * (first call, or the walker took a shortcut).
 */
export function snapToRoute(point: LonLat, route: PreparedRoute, hintAlongM?: number): SnapResult {
  const p = toXY(route, point);
  let best = { i: 0, d2: Infinity, t: 0 };

  if (hintAlongM != null) {
    best = nearestIn(route, p, hintAlongM - SEARCH_BEHIND_M, hintAlongM + SEARCH_AHEAD_M);
  }
  if (best.d2 > HUNT_SNAP_MAX_M * HUNT_SNAP_MAX_M) {
    const global = nearestIn(route, p, 0, route.total);
    if (global.d2 < best.d2) best = global;
  }

  const [ax, ay] = route.xy[best.i];
  const [bx, by] = route.xy[best.i + 1];
  const snappedXY: LonLat = [ax + best.t * (bx - ax), ay + best.t * (by - ay)];
  return {
    snapped: toLonLat(route, snappedXY),
    segmentIndex: best.i,
    offRouteM: Math.sqrt(best.d2),
    alongM: route.cum[best.i] + best.t * (route.cum[best.i + 1] - route.cum[best.i]),
  };
}

/** Point at a distance along the route, in local metres (clamped to both ends). */
function pointAlong(route: PreparedRoute, alongM: number): LonLat {
  const d = Math.min(route.total, Math.max(0, alongM));
  let i = 0;
  while (i < route.cum.length - 2 && route.cum[i + 1] < d) i++;
  const seg = route.cum[i + 1] - route.cum[i];
  const t = seg === 0 ? 0 : (d - route.cum[i]) / seg;
  const [ax, ay] = route.xy[i];
  const [bx, by] = route.xy[i + 1];
  return [ax + t * (bx - ax), ay + t * (by - ay)];
}

/**
 * Direction to face (degrees clockwise from north) when at alongM: toward the
 * point lookAheadM further on, so the turn starts slightly before each corner.
 * At the very end, keeps the direction of the last stretch.
 */
export function routeBearingAhead(route: PreparedRoute, alongM: number, lookAheadM = LOOK_AHEAD_M): number {
  let from = pointAlong(route, alongM);
  const to = pointAlong(route, alongM + lookAheadM);
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 1) from = pointAlong(route, route.total - lookAheadM);
  const deg = (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
  return (deg + 360) % 360;
}

import type { FeatureCollection } from "geojson";
import {
  extractRouteLine, prepareRoute, snapToRoute, routeBearingAhead, HUNT_SNAP_MAX_M,
  type PreparedRoute,
} from "../features/hunt/route-snap";

const ORIGIN: [number, number] = [2.3522, 48.8566];
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((ORIGIN[1] * Math.PI) / 180);

/** [lon, lat] at (east, north) metres from ORIGIN. */
function at(eastM: number, northM: number): [number, number] {
  return [ORIGIN[0] + eastM / M_PER_DEG_LON, ORIGIN[1] + northM / M_PER_DEG_LAT];
}

function toMeters([lon, lat]: [number, number]): [number, number] {
  return [(lon - ORIGIN[0]) * M_PER_DEG_LON, (lat - ORIGIN[1]) * M_PER_DEG_LAT];
}

// 100 m north, then 100 m east
const L_ROUTE = prepareRoute([at(0, 0), at(0, 100), at(100, 100)]) as PreparedRoute;

describe("extractRouteLine", () => {
  it("joins LineString parts without duplicating shared vertices", () => {
    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[0, 0], [1, 0]] } },
        { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: [[[1, 0], [1, 1]], [[1, 1], [2, 1]]] } },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [5, 5] } },
      ],
    };
    expect(extractRouteLine(fc)).toEqual([[0, 0], [1, 0], [1, 1], [2, 1]]);
  });

  it("returns nothing for a missing route", () => {
    expect(extractRouteLine(null)).toEqual([]);
    expect(prepareRoute([at(0, 0)])).toBeNull();
  });
});

describe("snapToRoute", () => {
  it("measures the route length", () => {
    expect(L_ROUTE.total).toBeCloseTo(200, 0);
  });

  it("snaps a point beside the first leg onto it", () => {
    const r = snapToRoute(at(6, 40), L_ROUTE);
    const [x, y] = toMeters(r.snapped);
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(40, 1);
    expect(r.offRouteM).toBeCloseTo(6, 1);
    expect(r.alongM).toBeCloseTo(40, 1);
    expect(r.segmentIndex).toBe(0);
  });

  it("snaps onto the second leg after the corner", () => {
    const r = snapToRoute(at(30, 104), L_ROUTE, 100);
    expect(r.segmentIndex).toBe(1);
    expect(r.alongM).toBeCloseTo(130, 1);
    expect(r.offRouteM).toBeCloseTo(4, 1);
  });

  it("reports the distance once off the route", () => {
    const r = snapToRoute(at(60, 40), L_ROUTE, 40);
    expect(r.offRouteM).toBeGreaterThan(HUNT_SNAP_MAX_M);
  });

  it("does not jump across a loop to a parallel stretch", () => {
    // Out 300 m north, 10 m east, back 300 m south: the two legs are 10 m apart
    const loop = prepareRoute([at(0, 0), at(0, 300), at(10, 300), at(10, 0)]) as PreparedRoute;
    // Walking out, slightly closer to the way back: stays on the way out
    const out = snapToRoute(at(6, 150), loop, 140);
    expect(out.segmentIndex).toBe(0);
    expect(out.alongM).toBeCloseTo(150, 0);
    // Without history the nearest leg wins
    expect(snapToRoute(at(6, 150), loop).segmentIndex).toBe(2);
    // Coming back, same spot: stays on the way back
    expect(snapToRoute(at(6, 150), loop, 450).segmentIndex).toBe(2);
  });

  it("finds the route again after a shortcut far from the hint", () => {
    const r = snapToRoute(at(95, 102), L_ROUTE, 0);
    expect(r.segmentIndex).toBe(1);
    expect(r.offRouteM).toBeLessThan(HUNT_SNAP_MAX_M);
  });
});

describe("routeBearingAhead", () => {
  it("faces north on the first leg", () => {
    expect(routeBearingAhead(L_ROUTE, 20)).toBeCloseTo(0, 0);
  });

  it("starts turning east before the corner", () => {
    const before = routeBearingAhead(L_ROUTE, 95);
    expect(before).toBeGreaterThan(10);
    expect(before).toBeLessThan(90);
  });

  it("faces east after the corner and at the end", () => {
    expect(routeBearingAhead(L_ROUTE, 150)).toBeCloseTo(90, 0);
    expect(routeBearingAhead(L_ROUTE, 200)).toBeCloseTo(90, 0);
  });
});

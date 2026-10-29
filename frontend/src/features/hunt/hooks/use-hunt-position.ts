import { useMemo, useRef } from "react";
import type { UserLocation } from "@/features/map/hooks/use-user-location";
import { snapToRoute, routeBearingAhead, HUNT_SNAP_MAX_M, type PreparedRoute } from "../route-snap";

/** Back on the route only once this close (hysteresis: no flicker around HUNT_SNAP_MAX_M). */
const RESNAP_M = 15;

export type HuntPosition = UserLocation & {
  /** True while the dot is glued to the route (heading = route direction). */
  onRoute: boolean;
};

/**
 * Where to draw the user while hunting: snapped onto the route and facing the way
 * it goes; off the route (detour), the real position and compass heading.
 * Returns the location unchanged when not hunting.
 */
export function useHuntPosition(location: UserLocation | null, route: PreparedRoute | null | undefined): HuntPosition | null {
  const alongRef = useRef<number | undefined>(undefined);
  const onRouteRef = useRef(true);

  const coords = location?.coords;
  const heading = location?.heading ?? null;
  return useMemo(() => {
    if (!coords) return null;
    const raw = { coords, heading };
    if (!route) {
      alongRef.current = undefined;
      onRouteRef.current = true;
      return { ...raw, onRoute: false };
    }
    const snap = snapToRoute(coords, route, alongRef.current);
    const onRoute = snap.offRouteM <= (onRouteRef.current ? HUNT_SNAP_MAX_M : RESNAP_M);
    onRouteRef.current = onRoute;
    if (!onRoute) return { ...raw, onRoute };
    alongRef.current = snap.alongM;
    return { coords: snap.snapped, heading: routeBearingAhead(route, snap.alongM), onRoute };
  }, [coords, heading, route]);
}

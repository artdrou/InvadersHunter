import { useCallback, useEffect, useMemo, useState } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { FeatureCollection } from "geojson";
import { hapticTap } from "@/features/settings";
import { extractRouteLine, prepareRoute } from "../route-snap";

const KEEP_AWAKE_TAG = "hunt";

/**
 * Hunt view state for the map screen: on / off, and paused while the user moves
 * the map by hand (Recenter resumes). The screen stays on while hunting.
 */
export function useHunt(routeGeojson: FeatureCollection | null | undefined) {
  const [hunting, setHunting] = useState(false);
  const [paused, setPaused] = useState(false);

  const route = useMemo(() => prepareRoute(extractRouteLine(routeGeojson)), [routeGeojson]);

  // Route cleared or recomputed elsewhere: leave the hunt view
  useEffect(() => {
    setHunting(false);
    setPaused(false);
  }, [route]);

  useEffect(() => {
    if (!hunting) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => { deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {}); };
  }, [hunting]);

  const start = useCallback(() => {
    if (!route) return;
    hapticTap();
    setPaused(false);
    setHunting(true);
  }, [route]);

  const stop = useCallback(() => {
    hapticTap();
    setHunting(false);
    setPaused(false);
  }, []);

  const pause = useCallback(() => setPaused(true), []);

  const recenter = useCallback(() => {
    hapticTap();
    setPaused(false);
  }, []);

  return {
    /** A route exists that can be hunted. */
    available: route !== null,
    hunting,
    paused,
    /** The route to follow while hunting, else null. */
    huntRoute: hunting ? route : null,
    start, stop, pause, recenter,
  };
}

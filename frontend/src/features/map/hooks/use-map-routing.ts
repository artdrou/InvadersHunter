import { useState, useMemo, useCallback } from "react";
import type { RefObject } from "react";
import type { InvaderWithState } from "@/features/invaders";
import { useRouting } from "@/features/routing/hooks/use-routing";
import type { RoutingParams } from "@/features/routing/types";
import { hapticTap } from "@/features/settings";
import type { WebMapHandle } from "../components/WebMap.native";

export type RoutingEndpoint = "from" | "to";

/**
 * Owns the whole routing flow layered on the map: the A→B / Walk endpoints, the
 * multi-invader mandatory-stop selection, the on-map endpoint picker, and the
 * computed route (via {@link useRouting}). The map screen wires the returned
 * state onto <RoutingFAB>, <RoutingSheet>, <RouteLayer> and the endpoint picker.
 */
export function useMapRouting(mapRef: RefObject<WebMapHandle | null>) {
  const { route, loading, error, computeRoute, clearRoute } = useRouting();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [multiInvaders, setMultiInvaders] = useState<InvaderWithState[]>([]);
  const [from, setFrom] = useState<[number, number] | null>(null);
  const [fromLabel, setFromLabel] = useState<string | null>(null);
  const [to, setTo] = useState<[number, number] | null>(null);
  const [toLabel, setToLabel] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<RoutingEndpoint | null>(null);

  // Highlight the mandatory stops whenever the sheet is open (tap to toggle).
  const selectedInvaderIds = useMemo(
    () => (sheetOpen ? multiInvaders.map((i) => i.id) : undefined),
    [sheetOpen, multiInvaders],
  );

  function setEndpoint(target: RoutingEndpoint, coords: [number, number] | null, label: string | null) {
    if (target === "from") { setFrom(coords); setFromLabel(label); }
    else { setTo(coords); setToLabel(label); }
  }

  // Stable identity: the map screen lists this in a useCallback dependency array.
  const toggleInvaderSelection = useCallback((invader: InvaderWithState) => {
    hapticTap();
    setMultiInvaders((prev) =>
      prev.some((i) => i.id === invader.id)
        ? prev.filter((i) => i.id !== invader.id)
        : [...prev, invader],
    );
  }, []);

  // ── On-map endpoint picker ──────────────────────────────────────────────────
  function handlePickOnMap(target: RoutingEndpoint) {
    setSheetOpen(false);
    setPickerTarget(target);
  }

  async function validatePicker() {
    const c = await mapRef.current?.getCenter();
    if (!c || !pickerTarget) return;
    const coords: [number, number] = [c[0], c[1]];
    const label = `${c[1].toFixed(5)}, ${c[0].toFixed(5)}`;
    setEndpoint(pickerTarget, coords, label);
    setPickerTarget(null);
    setSheetOpen(true);
  }

  function cancelPicker() {
    setPickerTarget(null);
    setSheetOpen(true);
  }

  // ── Sheet callbacks ─────────────────────────────────────────────────────────
  function onSetCoords(target: RoutingEndpoint, coords: [number, number], label: string) {
    setEndpoint(target, coords, label);
    if (route) clearRoute();
  }

  function onClearCoords(target: RoutingEndpoint) {
    setEndpoint(target, null, null);
    if (route) clearRoute();
  }

  function onCompute(params: RoutingParams) {
    computeRoute(params);
    setSheetOpen(false);
    setMultiInvaders([]);
  }

  return {
    route, loading, error,
    sheetOpen, setSheetOpen,
    multiInvaders, setMultiInvaders,
    from, fromLabel, to, toLabel,
    pickerTarget,
    selectedInvaderIds,
    toggleInvaderSelection,
    handlePickOnMap, validatePicker, cancelPicker,
    onSetCoords, onClearCoords, onCompute,
    clearRoute,
  };
}

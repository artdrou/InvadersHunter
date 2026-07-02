import { useState } from "react";
import type { RefObject } from "react";
import { MapZoom } from "../constants";
import type { WebMapHandle } from "../components/WebMap.native";

type LatLon = { lat: number; lon: number };

/**
 * State machine for the create-invader flow, which walks through three stages:
 *  1. `pickerOpen` — a {@link CreateHerePopup} pin dropped at the map center
 *  2. `modal`      — the full <CreateInvaderModal> form
 *  3. `pickLoc`    — an optional "adjust the location" pass on the map
 * The map screen renders the matching overlay for whichever stage is active.
 */
export function useMapCreateFlow(mapRef: RefObject<WebMapHandle | null>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modal, setModal] = useState<LatLon | null>(null);
  const [pickLoc, setPickLoc] = useState<LatLon | null>(null);

  /** Stage 1: drop the pin at (lat, lon) and offer to create here. */
  function begin(lat: number, lon: number) {
    mapRef.current?.centerOn(lat, lon, 0, MapZoom.detail);
    setPickerOpen(true);
  }

  function cancel() {
    setPickerOpen(false);
  }

  /** Stage 1 → 2: open the form on the pin's current center. */
  async function openModal() {
    const c = await mapRef.current?.getCenter();
    if (!c) return;
    setPickerOpen(false);
    setModal({ lat: c[1], lon: c[0] });
  }

  /** Stage 2 → 3: leave the form to fine-tune the location on the map. */
  function startPickLoc() {
    if (!modal) return;
    setPickLoc({ lat: modal.lat, lon: modal.lon });
    setModal(null);
    mapRef.current?.centerOn(modal.lat, modal.lon, 0, MapZoom.detail);
  }

  /** Stage 3 → 2: accept the adjusted center (falling back to the prior coords). */
  async function validatePickLoc() {
    const c = await mapRef.current?.getCenter();
    setModal({ lat: c ? c[1] : pickLoc!.lat, lon: c ? c[0] : pickLoc!.lon });
    setPickLoc(null);
  }

  /** Stage 3 → 2: discard the adjustment. */
  function cancelPickLoc() {
    setModal({ lat: pickLoc!.lat, lon: pickLoc!.lon });
    setPickLoc(null);
  }

  function closeModal() {
    setModal(null);
  }

  const anyActive = pickerOpen || modal !== null || pickLoc !== null;

  return {
    pickerOpen, modal, pickLoc, anyActive,
    begin, cancel, openModal, startPickLoc, validatePickLoc, cancelPickLoc, closeModal,
  };
}

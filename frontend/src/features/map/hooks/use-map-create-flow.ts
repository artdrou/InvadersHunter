import { useState } from "react";
import type { RefObject } from "react";
import type { CustomInvader } from "@/features/custom-invaders";
import { MapZoom } from "../constants";
import type { WebMapHandle } from "../components/WebMap.native";

type LatLon = { lat: number; lon: number };

type ModalState = LatLon & {
  /** Personal invader being edited; null when creating (community *or* personal —
   *  the form's own toggle decides which, so the flow doesn't need to know). */
  initial: CustomInvader | null;
};

/**
 * State machine for the create-invader flow, which walks through three stages:
 *  1. `pickerOpen` — a {@link CreateHerePopup} pin dropped at the map center
 *  2. `modal`      — the full <CreateInvaderModal> form
 *  3. `pickLoc`    — an optional "adjust the location" pass on the map
 * The map screen renders the matching overlay for whichever stage is active.
 *
 * Editing a personal invader enters at stage 2 via {@link editPersonal}, skipping
 * the pin: the row already has a position.
 */
export function useMapCreateFlow(mapRef: RefObject<WebMapHandle | null>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  // Holds the whole form state, not just the coords: the form unmounts during
  // this stage, so anything not parked here (personal mode, the edited row)
  // would be lost on the way back.
  const [pickLoc, setPickLoc] = useState<ModalState | null>(null);

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
    setModal({ lat: c[1], lon: c[0], initial: null });
  }

  /** Enter stage 2 directly to edit an existing personal invader. */
  function editPersonal(invader: CustomInvader) {
    if (invader.latitude == null || invader.longitude == null) return;
    setPickerOpen(false);
    setModal({ lat: invader.latitude, lon: invader.longitude, initial: invader });
  }

  /** Stage 2 → 3: leave the form to fine-tune the location on the map. */
  function startPickLoc() {
    if (!modal) return;
    setPickLoc(modal);
    mapRef.current?.centerOn(modal.lat, modal.lon, 0, MapZoom.detail);
    setModal(null);
  }

  /** Stage 3 → 2: accept the adjusted center (falling back to the prior coords).
   *  Restores whatever the form was doing — personal mode and the edited row. */
  async function validatePickLoc() {
    if (!pickLoc) return;
    const c = await mapRef.current?.getCenter();
    setModal({ ...pickLoc, lat: c ? c[1] : pickLoc.lat, lon: c ? c[0] : pickLoc.lon });
    setPickLoc(null);
  }

  /** Stage 3 → 2: discard the adjustment. */
  function cancelPickLoc() {
    if (!pickLoc) return;
    setModal(pickLoc);
    setPickLoc(null);
  }

  function closeModal() {
    setModal(null);
  }

  const anyActive = pickerOpen || modal !== null || pickLoc !== null;

  return {
    pickerOpen, modal, pickLoc, anyActive,
    begin, cancel, openModal, editPersonal, startPickLoc, validatePickLoc, cancelPickLoc, closeModal,
  };
}

// Map filter model + pure helpers. Kept in a leaf module (no component/barrel
// imports) so cross-feature consumers — invaders list, ISS marker, geojson hook —
// can use it without pulling in the MapFilterBar component or the map barrel,
// which previously formed a require cycle (see CONVENTIONS.md → Barrels).
import { isNonFlashable } from "@/features/invaders/types";

export type FlashStatusFilter = "all" | "flashed" | "unflashed";
export type FlashableFilter = "any" | "flashable" | "unflashable";
export type GreyMode = "none" | "all" | "unflashed";
export type ColorMode = "flash" | "rarity";

export type MapFilter = {
  status: FlashStatusFilter;
  flashable: FlashableFilter;
  points: number[];
};

export const DEFAULT_FILTER: MapFilter = { status: "all", flashable: "any", points: [] };

export function isFilterActive(f: MapFilter) {
  return f.status !== "all" || f.flashable !== "any" || f.points.length > 0;
}

export function applyMapFilter<T extends { isCaptured: boolean; state: string | null; points?: number | null }>(
  invaders: T[],
  filter: MapFilter
): T[] {
  return invaders.filter((i) => {
    if (filter.status === "flashed" && !i.isCaptured) return false;
    if (filter.status === "unflashed" && i.isCaptured) return false;
    if (filter.flashable === "flashable" && isNonFlashable(i.state)) return false;
    if (filter.flashable === "unflashable" && !isNonFlashable(i.state)) return false;
    if (filter.points.length > 0 && !filter.points.includes(i.points ?? 0)) return false;
    return true;
  });
}

import type { InvaderWithState } from "@/features/invaders/types";
import { groupByCity } from "@/features/invaders/utils/invader-list";
import { ISS_INVADER_NAME } from "@/features/iss/constants";

/** Lowercase, no separators, no zero padding — "PA_05", "pa 5" and "pa5" all match. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-]/g, "").replace(/(^|\D)0+(?=\d)/g, "$1");
}

/**
 * Invaders not on the map yet (no position), grouped by city and filtered by a
 * search on the name — what the "add a location to an existing invader" list shows.
 */
export function missingLocationGroups(
  invaders: InvaderWithState[],
  query: string,
): [string, InvaderWithState[]][] {
  const q = normalize(query.trim());
  const missing = invaders.filter(
    (i) =>
      (i.latitude == null || i.longitude == null) &&
      i.name !== ISS_INVADER_NAME &&
      (!q || normalize(i.name).includes(q)),
  );
  return groupByCity(missing);
}

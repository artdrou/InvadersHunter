import type { InvaderWithState } from "./types";

/** An invader detail a user can propose. */
export type EditField = "points" | "state" | "posed" | "location" | "photo";

/** Which details are missing, so the info lines can offer "+ Add" for them. */
export function missingFields(invader: Pick<InvaderWithState,
  "points" | "state" | "date_pose" | "latitude" | "longitude" | "image_url">): Set<EditField> {
  const missing = new Set<EditField>();
  if (invader.points == null) missing.add("points");
  if (!invader.state || invader.state === "Unknown") missing.add("state");
  if (!invader.date_pose) missing.add("posed");
  if (invader.latitude == null || invader.longitude == null) missing.add("location");
  if (!invader.image_url) missing.add("photo");
  return missing;
}

/** Filter chips order on the incomplete-invaders page (most useful first). */
export const EDIT_FIELDS: EditField[] = ["location", "photo", "points", "state", "posed"];

type Incompletable = Parameters<typeof missingFields>[0] & { id: number; name: string };

export type IncompleteGroup<T> = { city: string; items: { invader: T; missing: Set<EditField> }[] };

/**
 * Incomplete invaders grouped by city (cities and invaders in name order).
 * `filter`: keep invaders missing ANY of these fields (empty = missing anything).
 * `counts`: how many invaders miss each field (and `all`: anything), whatever the filter.
 */
export function groupIncomplete<T extends Incompletable>(
  invaders: T[], filter: ReadonlySet<EditField>, cityOf: (name: string) => string,
): { groups: IncompleteGroup<T>[]; counts: Record<EditField | "all", number> } {
  const counts = { all: 0, location: 0, photo: 0, points: 0, state: 0, posed: 0 };
  const byCity = new Map<string, IncompleteGroup<T>["items"]>();
  for (const invader of invaders) {
    const missing = missingFields(invader);
    if (missing.size === 0) continue;
    counts.all += 1;
    missing.forEach((f) => { counts[f] += 1; });
    if (filter.size > 0 && ![...filter].some((f) => missing.has(f))) continue;
    const city = cityOf(invader.name);
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push({ invader, missing });
  }
  const groups = [...byCity.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([city, items]) => ({
      city,
      items: items.sort((a, b) => a.invader.name.localeCompare(b.invader.name, undefined, { numeric: true })),
    }));
  return { groups, counts };
}

/** Details a proposal covers (one pending proposal per user, invader and detail). */
export function requestFields(r: {
  proposed_state?: string | null; proposed_latitude?: number | null; proposed_longitude?: number | null;
  proposed_points?: number | null; proposed_date_pose?: string | null; proposed_image_url?: string | null;
}): EditField[] {
  const out: EditField[] = [];
  if (r.proposed_latitude != null || r.proposed_longitude != null) out.push("location");
  if (r.proposed_image_url) out.push("photo");
  if (r.proposed_points != null) out.push("points");
  if (r.proposed_state) out.push("state");
  if (r.proposed_date_pose) out.push("posed");
  return out;
}

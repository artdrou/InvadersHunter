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

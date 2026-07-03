import { cityOf } from "@/features/invaders/utils/invader-list";

/**
 * Detect the zero-padding width used by existing invaders in a city (e.g. names
 * like "PA_0123" → 4). Returns 0 when the city is unknown or its names use no
 * zero-padding, so the user's number is then left exactly as typed.
 */
export function cityNumberPadding(city: string, invaders: { name: string }[]): number {
  const target = city.trim().toUpperCase();
  if (!target) return 0;
  const matching = invaders.filter((inv) => cityOf(inv.name) === target);
  if (matching.length === 0) return 0;
  for (const inv of matching) {
    const idx = inv.name.indexOf("_");
    if (idx === -1) continue;
    const numStr = inv.name.slice(idx + 1);
    if (/^\d+$/.test(numStr) && numStr.length > 1 && numStr.startsWith("0")) {
      return numStr.length;
    }
  }
  return 0;
}

/** Build the "CITY_0NN" name from raw inputs, applying the detected padding. */
export function buildProposedName(city: string, num: string, padding: number): string {
  const c = city.trim().toUpperCase();
  const n = num.trim();
  const formatted = padding > 0 ? n.padStart(padding, "0") : n;
  return c + (c && n ? "_" + formatted : "");
}

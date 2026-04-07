import type { InvaderWithState } from "../types";

export function cityOf(name: string): string {
  const idx = name.indexOf("_");
  return (idx === -1 ? name : name.slice(0, idx)).toUpperCase();
}

export function numOf(name: string): number {
  const idx = name.indexOf("_");
  return idx === -1 ? 0 : parseInt(name.slice(idx + 1), 10) || 0;
}

export function groupByCity(invaders: InvaderWithState[]): [string, InvaderWithState[]][] {
  const map = new Map<string, InvaderWithState[]>();
  for (const inv of invaders) {
    const city = cityOf(inv.name);
    if (!map.has(city)) map.set(city, []);
    map.get(city)!.push(inv);
  }
  for (const list of map.values()) {
    list.sort((a, b) => numOf(a.name) - numOf(b.name));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

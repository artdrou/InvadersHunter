import type { InvaderWithState } from "../types";
import { getDateLocale } from "@/services/i18n";

export type GroupMode  = "city" | "points" | "year";
export type SortOption = "number" | "points" | "pose_date" | "flash_date" | "update_date";

// Sort options available for each group mode — excludes the dimension already used for grouping
export const SORT_OPTIONS_BY_GROUP: Record<GroupMode, SortOption[]> = {
  city:   ["number", "points", "pose_date", "flash_date", "update_date"],
  points: ["number", "pose_date", "flash_date", "update_date"],
  year:   ["number", "points", "flash_date", "update_date"],
};

export function cityOf(name: string): string {
  const idx = name.indexOf("_");
  return (idx === -1 ? name : name.slice(0, idx)).toUpperCase();
}

export function numOf(name: string): number {
  const idx = name.indexOf("_");
  return idx === -1 ? 0 : parseInt(name.slice(idx + 1), 10) || 0;
}

function dateMs(s?: string | null) {
  return s ? new Date(s).getTime() : 0;
}

function sortWithinGroup(list: InvaderWithState[], sortBy: SortOption): InvaderWithState[] {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case "points":      return (b.points ?? 0) - (a.points ?? 0);
      case "pose_date":   return dateMs(b.date_pose) - dateMs(a.date_pose);
      case "flash_date":  return dateMs(b.capturedAt) - dateMs(a.capturedAt);
      case "update_date": return dateMs(b.updated_at) - dateMs(a.updated_at);
      default:            return numOf(a.name) - numOf(b.name);
    }
  });
}

function groupByCity(invaders: InvaderWithState[]): [string, InvaderWithState[]][] {
  const map = new Map<string, InvaderWithState[]>();
  for (const inv of invaders) {
    const city = cityOf(inv.name);
    if (!map.has(city)) map.set(city, []);
    map.get(city)!.push(inv);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([city, list]) => [city, list.sort((a, b) => numOf(a.name) - numOf(b.name))]);
}

function groupByPoints(invaders: InvaderWithState[]): [string, InvaderWithState[]][] {
  const map = new Map<number, InvaderWithState[]>();
  for (const inv of invaders) {
    const pts = inv.points ?? 0;
    if (!map.has(pts)) map.set(pts, []);
    map.get(pts)!.push(inv);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b - a)
    .map(([pts, list]) => [`${pts} pts`, list.sort((a, b) => numOf(a.name) - numOf(b.name))]);
}

function groupByYear(invaders: InvaderWithState[]): [string, InvaderWithState[]][] {
  const map = new Map<string, InvaderWithState[]>();
  for (const inv of invaders) {
    const year = inv.date_pose ? new Date(inv.date_pose).getFullYear().toString() : "—";
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(inv);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return parseInt(b) - parseInt(a);
    })
    .map(([year, list]) => [year, list.sort((a, b) => numOf(a.name) - numOf(b.name))]);
}

export function buildGroups(
  invaders: InvaderWithState[],
  groupMode: GroupMode,
  sortBy: SortOption,
): [string, InvaderWithState[]][] {
  const base = groupMode === "points" ? groupByPoints(invaders)
             : groupMode === "year"   ? groupByYear(invaders)
             :                         groupByCity(invaders);
  if (sortBy === "number") return base;
  return base.map(([key, list]) => [key, sortWithinGroup(list, sortBy)]);
}

// cityOf / numOf are kept as public utilities used elsewhere (CityHeader labels, etc.)

export function formatDate(iso?: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString(getDateLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

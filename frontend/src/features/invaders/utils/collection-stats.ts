import type { Invader } from '../types';
import { isNonFlashable } from '../types';
import { cityOf } from './invader-list';

export type CollectionStats = {
  flashed: number;
  citiesWithFlashes: number;
  completeCities: number;
  destroyedFlashed: number;
  remaining: number;
  topCity: { name: string; captured: number; total: number } | null;
};

/**
 * Collection stats for one user, from the full invader list and the ids that
 * user has flashed. Shared by the user's own profile and the admin user page.
 */
export function computeCollectionStats(invaders: Invader[], flashedIds: Set<number>): CollectionStats {
  // City breakdown — total invaders per city + captured per city.
  const byCity = new Map<string, { captured: number; total: number }>();
  let flashed = 0;
  let destroyedFlashed = 0;
  let remaining = 0;
  for (const inv of invaders) {
    const isCaptured = flashedIds.has(inv.id);
    const c = cityOf(inv.name);
    const e = byCity.get(c) ?? { captured: 0, total: 0 };
    e.total++;
    if (isCaptured) {
      e.captured++;
      flashed++;
      if ((inv.state ?? '').toLowerCase() === 'destroyed') destroyedFlashed++;
    } else if (!isNonFlashable(inv.state)) {
      remaining++;
    }
    byCity.set(c, e);
  }

  let completeCities = 0;
  let citiesWithFlashes = 0;
  // "Top city": city with the highest absolute count of captured invaders.
  let topCity: CollectionStats['topCity'] = null;
  for (const [name, c] of byCity) {
    if (c.total > 0 && c.captured === c.total) completeCities++;
    if (c.captured === 0) continue;
    citiesWithFlashes++;
    if (!topCity || c.captured > topCity.captured) {
      topCity = { name, captured: c.captured, total: c.total };
    }
  }

  return { flashed, citiesWithFlashes, completeCities, destroyedFlashed, remaining, topCity };
}

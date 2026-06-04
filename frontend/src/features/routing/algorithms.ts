import type { InvaderWithState } from '../invaders/types'

/**
 * Keeps only invaders inside the bounding box formed by `from` and `to`,
 * expanded by `marginPct` percent on each side.
 */
// ~1km in degrees — ensures the bbox never collapses to nearly nothing
// when from and to are very close together
const MIN_MARGIN_DEG = 0.01

export function bboxFilter(
  invaders: InvaderWithState[],
  from: [number, number],
  to: [number, number],
  marginPct = 50,
): InvaderWithState[] {
  const margin = marginPct / 100
  const minLng = Math.min(from[0], to[0])
  const maxLng = Math.max(from[0], to[0])
  const minLat = Math.min(from[1], to[1])
  const maxLat = Math.max(from[1], to[1])
  const dLng = Math.max((maxLng - minLng) * margin, MIN_MARGIN_DEG)
  const dLat = Math.max((maxLat - minLat) * margin, MIN_MARGIN_DEG)

  return invaders.filter((inv) => {
    if (inv.longitude == null || inv.latitude == null) return false
    return (
      inv.longitude >= minLng - dLng &&
      inv.longitude <= maxLng + dLng &&
      inv.latitude  >= minLat - dLat &&
      inv.latitude  <= maxLat + dLat
    )
  })
}

/**
 * Greedy nearest-neighbor TSP.
 * Returns the visit order as an array of indices into `invaders`.
 * Uses the `durations` matrix (durations[i][j] = seconds from i to j).
 */
export function nearestNeighborTSP(
  invaders: InvaderWithState[],
  durations: number[][],
  startIndex = 0,
): number[] {
  const n = invaders.length
  if (n === 0) return []
  if (n === 1) return [0]

  const visited = new Set<number>()
  const order: number[] = []
  let current = startIndex

  while (order.length < n) {
    visited.add(current)
    order.push(current)
    if (order.length === n) break

    let nearest = -1
    let minDur = Infinity
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && durations[current][j] < minDur) {
        minDur = durations[current][j]
        nearest = j
      }
    }
    current = nearest
  }

  return order
}

/**
 * Finds the best position to insert `candidateCoord` into the current route
 * and returns the index at which to insert and the extra duration cost.
 *
 * `routeDurations[i][j]` is the duration between point i and point j,
 * where indices 0..route.length-1 correspond to `route`, and
 * index `route.length` corresponds to `candidateCoord`.
 *
 * Returns `{ insertAt, extraSec }` where `insertAt` is the index in `route`
 * AFTER which the candidate should be inserted (0 = before first point).
 */
export function optimalInsertion(
  routeLength: number,
  candidateIndex: number,
  getDuration: (from: number, to: number) => number,
): { insertAt: number; extraSec: number } {
  let bestInsertAt = 0
  let bestExtra = Infinity

  for (let i = 0; i < routeLength - 1; i++) {
    const before = getDuration(i, candidateIndex)
    const after  = getDuration(candidateIndex, i + 1)
    const saved  = getDuration(i, i + 1)
    const extra  = before + after - saved
    if (extra < bestExtra) {
      bestExtra   = extra
      bestInsertAt = i + 1
    }
  }

  return { insertAt: bestInsertAt, extraSec: bestExtra }
}

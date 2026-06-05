import { useState, useRef, useCallback } from 'react'
import type { InvaderWithState } from '../../invaders/types'
import { fetchDirections, fetchMatrix } from '../ors-client'
import { bboxFilter, nearestNeighborTSP } from '../algorithms'
import type { RoutingParams, RouteResult, TravelMode } from '../types'

const MATRIX_MAX_POINTS = 50
const DEBOUNCE_MS = 500

function invaderCoord(inv: InvaderWithState): [number, number] {
  return [inv.longitude!, inv.latitude!]
}

function hasCoords(inv: InvaderWithState): inv is InvaderWithState & { longitude: number; latitude: number } {
  return inv.longitude != null && inv.latitude != null
}

// Greedy optimal insertion into a route using a pre-computed distance matrix.
// routeIndices: indices into the distance matrix representing the current route.
// candidateIdx: matrix index of the point to insert.
// Returns { bestPos, bestExtra }.
function bestInsertion(
  routeIndices: number[],
  candidateIdx: number,
  durations: number[][],
): { bestPos: number; bestExtra: number } {
  let bestExtra = Infinity
  let bestPos = 1
  for (let pos = 1; pos < routeIndices.length; pos++) {
    const prev = routeIndices[pos - 1]
    const next = routeIndices[pos]
    const extra = durations[prev][candidateIdx] + durations[candidateIdx][next] - durations[prev][next]
    if (extra < bestExtra) {
      bestExtra = extra
      bestPos = pos
    }
  }
  return { bestPos, bestExtra }
}

// ── mode ab ────────────────────────────────────────────────────────────────
// 2–3 ORS requests total (was 3 + N where N = invaders within budget)

async function computeAb(
  from: [number, number],
  to: [number, number],
  invaders: InvaderWithState[],
  travelMode: TravelMode,
  detourPct: number,
): Promise<RouteResult> {
  const candidates = invaders.filter(hasCoords).filter((inv) => !inv.isCaptured)

  // request 1: base route for budget
  const base = await fetchDirections(travelMode, [from, to])
  const baseSeconds = base.durationSec
  const budget = baseSeconds * (1 + detourPct / 100)

  if (candidates.length === 0) {
    return {
      geojson: base.geojson,
      orderedInvaders: [],
      totalMinutes: Math.round(base.durationSec / 60),
      totalKm: Math.round(base.distanceKm * 10) / 10,
      detourMinutes: 0,
    }
  }

  const filtered = candidates.length > MATRIX_MAX_POINTS - 2
    ? bboxFilter(candidates, from, to).slice(0, MATRIX_MAX_POINTS - 2)
    : candidates

  // request 2: single full matrix covering all points at once
  // layout: from(0), candidates(1..n), to(n+1)
  const allLocs: [number, number][] = [from, ...filtered.map(invaderCoord), to]
  const toIdx = allLocs.length - 1
  const { durations } = await fetchMatrix(travelMode, allLocs)

  const withDetour = filtered
    .map((inv, i) => {
      const matIdx = i + 1
      const detourSec = durations[0][matIdx] + durations[matIdx][toIdx] - baseSeconds
      return { inv, detourSec, matIdx }
    })
    .filter(({ detourSec }) => detourSec <= baseSeconds * detourPct / 100)
    .sort((a, b) => a.detourSec - b.detourSec)

  // greedy insertion — all distances already in matrix, zero extra requests
  const routeIndices: number[] = [0, toIdx]
  let routeTimeSec = baseSeconds
  const orderedRoute: InvaderWithState[] = []

  for (const { inv, matIdx } of withDetour) {
    if (routeIndices.length >= MATRIX_MAX_POINTS) break
    const { bestPos, bestExtra } = bestInsertion(routeIndices, matIdx, durations)
    if (routeTimeSec + bestExtra <= budget) {
      routeTimeSec += bestExtra
      routeIndices.splice(bestPos, 0, matIdx)
      orderedRoute.splice(bestPos - 1, 0, inv)
    }
  }

  if (orderedRoute.length === 0) {
    return {
      geojson: base.geojson,
      orderedInvaders: [],
      totalMinutes: Math.round(base.durationSec / 60),
      totalKm: Math.round(base.distanceKm * 10) / 10,
      detourMinutes: 0,
    }
  }

  // request 3: final directions
  const finalCoords = routeIndices.map((i) => allLocs[i])
  const final = await fetchDirections(travelMode, finalCoords)

  return {
    geojson: final.geojson,
    orderedInvaders: orderedRoute,
    totalMinutes: Math.round(final.durationSec / 60),
    totalKm: Math.round(final.distanceKm * 10) / 10,
    detourMinutes: Math.round((final.durationSec - baseSeconds) / 60),
  }
}

// ── mode multi ─────────────────────────────────────────────────────────────
// 2 ORS requests (unchanged)

async function computeMulti(
  invaders: InvaderWithState[],
  travelMode: TravelMode,
): Promise<RouteResult> {
  const valid = invaders.filter(hasCoords)
  if (valid.length < 2) throw new Error('At least 2 invaders with coordinates required')

  const locs = valid.map(invaderCoord)
  const { durations } = await fetchMatrix(travelMode, locs)
  const order = nearestNeighborTSP(valid, durations, 0)
  const ordered = order.map((i) => valid[i])

  const final = await fetchDirections(travelMode, ordered.map(invaderCoord))

  return {
    geojson: final.geojson,
    orderedInvaders: ordered,
    totalMinutes: Math.round(final.durationSec / 60),
    totalKm: Math.round(final.distanceKm * 10) / 10,
  }
}

// ── mode walk ──────────────────────────────────────────────────────────────
// circuit: 1–2 ORS requests (was 3)
// libre:   2–3 ORS requests (was 4 + N)

async function computeWalk(
  from: [number, number],
  invaders: InvaderWithState[],
  travelMode: TravelMode,
  durationMin: number,
  walkMode: 'circuit' | 'libre',
  to?: [number, number],
): Promise<RouteResult> {
  const valid = invaders.filter(hasCoords).filter((inv) => !inv.isCaptured)
  const budgetSec = durationMin * 60

  if (walkMode === 'circuit') {
    const effectiveBudget = budgetSec * 0.88

    const sorted = [...valid].sort((a, b) => {
      const da = Math.hypot(a.longitude! - from[0], a.latitude! - from[1])
      const db = Math.hypot(b.longitude! - from[0], b.latitude! - from[1])
      return da - db
    })

    // request 1: matrix [from, ...sorted_candidates]
    const locs: [number, number][] = [from, ...sorted.map(invaderCoord)]
    const { durations } = await fetchMatrix(travelMode, locs.slice(0, MATRIX_MAX_POINTS))

    const selected: number[] = []
    let currentIdx = 0
    let timeUsed = 0

    for (let i = 0; i < sorted.length && i < MATRIX_MAX_POINTS - 1; i++) {
      const timeToInv = durations[currentIdx][i + 1]
      const timeBack  = durations[i + 1][0]
      if (timeUsed + timeToInv + timeBack <= effectiveBudget) {
        timeUsed += timeToInv
        currentIdx = i + 1
        selected.push(i)
      }
    }

    if (selected.length === 0) {
      const final = await fetchDirections(travelMode, [from, from])
      return { geojson: final.geojson, orderedInvaders: [], totalMinutes: 0, totalKm: 0 }
    }

    // extract TSP sub-matrix from the existing durations — no extra request
    const selMatIdx = selected.map((i) => i + 1)
    const selectedInvaders = selected.map((i) => sorted[i])
    const n = selMatIdx.length
    const selDur: number[][] = Array.from({ length: n }, (_, a) =>
      Array.from({ length: n }, (_, b) => durations[selMatIdx[a]][selMatIdx[b]]),
    )

    const order = nearestNeighborTSP(selectedInvaders, selDur, 0)
    const ordered = order.map((i) => selectedInvaders[i])

    // request 2: final directions
    const waypoints: [number, number][] = [from, ...ordered.map(invaderCoord), from]
    const final = await fetchDirections(travelMode, waypoints)

    return {
      geojson: final.geojson,
      orderedInvaders: ordered,
      totalMinutes: Math.round(final.durationSec / 60),
      totalKm: Math.round(final.distanceKm * 10) / 10,
    }
  }

  // libre: from → [...invaders] → to
  if (!to) throw new Error('walk libre mode requires a destination')

  // request 1: base route
  const baseRoute = await fetchDirections(travelMode, [from, to])
  const baseSeconds = baseRoute.durationSec
  const detourBudget = budgetSec - baseSeconds

  const filtered = valid.length > MATRIX_MAX_POINTS - 2
    ? bboxFilter(valid, from, to).slice(0, MATRIX_MAX_POINTS - 2)
    : valid

  // request 2: single full matrix [from, ...candidates, to]
  const allLocs: [number, number][] = [from, ...filtered.map(invaderCoord), to]
  const toIdx = allLocs.length - 1
  const { durations } = await fetchMatrix(travelMode, allLocs)

  const withDetour = filtered
    .map((inv, i) => {
      const matIdx = i + 1
      const detourSec = durations[0][matIdx] + durations[matIdx][toIdx] - baseSeconds
      return { inv, detourSec, matIdx }
    })
    .filter(({ detourSec }) => detourSec <= detourBudget)
    .sort((a, b) => a.detourSec - b.detourSec)

  const routeIndices: number[] = [0, toIdx]
  let routeTimeSec = baseSeconds
  const orderedRoute: InvaderWithState[] = []

  for (const { inv, matIdx } of withDetour) {
    if (routeIndices.length >= MATRIX_MAX_POINTS) break
    const { bestPos, bestExtra } = bestInsertion(routeIndices, matIdx, durations)
    if (routeTimeSec + bestExtra <= budgetSec) {
      routeTimeSec += bestExtra
      routeIndices.splice(bestPos, 0, matIdx)
      orderedRoute.splice(bestPos - 1, 0, inv)
    }
  }

  if (orderedRoute.length === 0) {
    return {
      geojson: baseRoute.geojson,
      orderedInvaders: [],
      totalMinutes: Math.round(baseRoute.durationSec / 60),
      totalKm: Math.round(baseRoute.distanceKm * 10) / 10,
    }
  }

  // request 3: final directions
  const finalCoords = routeIndices.map((i) => allLocs[i])
  const final = await fetchDirections(travelMode, finalCoords)

  return {
    geojson: final.geojson,
    orderedInvaders: orderedRoute,
    totalMinutes: Math.round(final.durationSec / 60),
    totalKm: Math.round(final.distanceKm * 10) / 10,
  }
}

// ── hook ───────────────────────────────────────────────────────────────────

export function useRouting() {
  const [route, setRoute]     = useState<RouteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null)

  const computeRoute = useCallback((params: RoutingParams) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        let result: RouteResult
        if (params.mode === 'ab') {
          result = await computeAb(params.from, params.to, params.invaders, params.travelMode, params.detourPct)
        } else if (params.mode === 'multi') {
          result = await computeMulti(params.invaders, params.travelMode)
        } else {
          result = await computeWalk(params.from, params.invaders, params.travelMode, params.durationMin, params.walkMode, params.to)
        }
        setRoute(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Routing error')
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
  }, [])

  const clearRoute = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setRoute(null)
    setError(null)
  }, [])

  return { route, loading, error, computeRoute, clearRoute }
}

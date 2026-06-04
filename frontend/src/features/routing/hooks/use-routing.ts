import { useState, useRef, useCallback } from 'react'
import type { InvaderWithState } from '../../invaders/types'
import { fetchDirections, fetchMatrix } from '../ors-client'
import { bboxFilter, nearestNeighborTSP, optimalInsertion } from '../algorithms'
import type { RoutingParams, RouteResult, TravelMode } from '../types'

const MATRIX_MAX_POINTS = 50
const DEBOUNCE_MS = 500

function invaderCoord(inv: InvaderWithState): [number, number] {
  return [inv.longitude!, inv.latitude!]
}

function hasCoords(inv: InvaderWithState): inv is InvaderWithState & { longitude: number; latitude: number } {
  return inv.longitude != null && inv.latitude != null
}

// ── mode ab ────────────────────────────────────────────────────────────────

async function computeAb(
  from: [number, number],
  to: [number, number],
  invaders: InvaderWithState[],
  travelMode: TravelMode,
  detourPct: number,
): Promise<RouteResult> {
  const candidates = invaders.filter(hasCoords).filter((inv) => !inv.isCaptured)

  // Step 1 — base A→B duration
  const base = await fetchDirections(travelMode, [from, to])
  const baseSeconds = base.durationSec

  // Step 2 — corridor filter + detour per invader via matrix
  const filtered = candidates.length > MATRIX_MAX_POINTS
    ? bboxFilter(candidates, from, to)
    : candidates

  const matrixLocs: [number, number][] = [from, ...filtered.map(invaderCoord), to]
  const toIdx = matrixLocs.length - 1

  const { durations } = await fetchMatrix(travelMode, matrixLocs, [0], undefined)
  // durations[0][j] = from→j, we also need inv→to
  const invToTo = await fetchMatrix(travelMode, matrixLocs, undefined, [toIdx])
  // invToTo.durations[i][0] = i→to

  const budget = baseSeconds * (1 + detourPct / 100)

  const withDetour = filtered
    .map((inv, i) => {
      const detourSec = durations[0][i + 1] + invToTo.durations[i + 1][0] - baseSeconds
      return { inv, detourSec }
    })
    .filter(({ detourSec }) => detourSec <= baseSeconds * detourPct / 100)
    .sort((a, b) => a.detourSec - b.detourSec)

  // Step 3 — optimal insertion, maintaining actual route order via splice
  const orderedRoute: InvaderWithState[] = []
  let routeTimeSec = baseSeconds

  for (const { inv } of withDetour) {
    if (orderedRoute.length + 2 >= MATRIX_MAX_POINTS) break

    const full = await fetchMatrix(travelMode, [from, ...orderedRoute.map(invaderCoord), to, invaderCoord(inv)])
    const n = full.durations.length
    const candIdx = n - 1
    const routeLen = n - 1 // from + orderedRoute + to

    const { insertAt, extraSec } = optimalInsertion(routeLen, candIdx, (a, b) => full.durations[a][b])

    if (routeTimeSec + extraSec <= budget) {
      routeTimeSec += extraSec
      // insertAt is the index in the full route; subtract 1 to get index in orderedRoute
      orderedRoute.splice(insertAt - 1, 0, inv)
    }
  }

  // Step 4 — final route
  const finalCoords: [number, number][] = [from, ...orderedRoute.map(invaderCoord), to]
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
    // Reserve time to return to start, effective budget is 88% to leave room for TSP ordering
    const effectiveBudget = budgetSec * 0.88

    // Sort by straight-line distance from `from` (pre-filter before matrix)
    const sorted = [...valid].sort((a, b) => {
      const da = Math.hypot(a.longitude! - from[0], a.latitude! - from[1])
      const db = Math.hypot(b.longitude! - from[0], b.latitude! - from[1])
      return da - db
    })

    // Greedy selection: add invader if time-to-inv + time-back ≤ remaining budget
    const locs: [number, number][] = [from, ...sorted.map(invaderCoord)]
    const { durations } = await fetchMatrix(travelMode, locs.slice(0, MATRIX_MAX_POINTS))

    const selected: number[] = [] // indices into sorted
    let currentIdx = 0            // current position in the matrix (0 = from)
    let timeUsed = 0

    for (let i = 0; i < sorted.length && i < MATRIX_MAX_POINTS - 1; i++) {
      const timeToInv = durations[currentIdx][i + 1]  // from current pos → this invader
      const timeBack  = durations[i + 1][0]           // this invader → from
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

    // Optimize order with TSP on selected invaders
    const selectedInvaders = selected.map((i) => sorted[i])
    const selLocs = selectedInvaders.map(invaderCoord)
    const { durations: selDur } = await fetchMatrix(travelMode, selLocs)
    const order = nearestNeighborTSP(selectedInvaders, selDur, 0)
    const ordered = order.map((i) => selectedInvaders[i])

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

  const baseRoute = await fetchDirections(travelMode, [from, to])
  const baseSeconds = baseRoute.durationSec
  const detourBudget = budgetSec - baseSeconds

  const filtered = valid.length > MATRIX_MAX_POINTS ? bboxFilter(valid, from, to) : valid

  // Reuse ab-style insertion within the detour budget
  const matrixLocs: [number, number][] = [from, ...filtered.map(invaderCoord), to]
  const toIdx = matrixLocs.length - 1
  const fromToAll = await fetchMatrix(travelMode, matrixLocs, [0], undefined)
  const allToTo  = await fetchMatrix(travelMode, matrixLocs, undefined, [toIdx])

  const withDetour = filtered
    .map((inv, i) => ({
      inv,
      detourSec: fromToAll.durations[0][i + 1] + allToTo.durations[i + 1][0] - baseSeconds,
    }))
    .filter(({ detourSec }) => detourSec <= detourBudget)
    .sort((a, b) => a.detourSec - b.detourSec)

  const orderedRoute: InvaderWithState[] = []
  let routeTimeSec = baseSeconds

  for (const { inv } of withDetour) {
    if (orderedRoute.length + 2 >= MATRIX_MAX_POINTS) break

    const full = await fetchMatrix(travelMode, [from, ...orderedRoute.map(invaderCoord), to, invaderCoord(inv)])
    const n = full.durations.length
    const { insertAt, extraSec } = optimalInsertion(n - 1, n - 1, (a, b) => full.durations[a][b])

    if (routeTimeSec + extraSec <= budgetSec) {
      routeTimeSec += extraSec
      orderedRoute.splice(insertAt - 1, 0, inv)
    }
  }

  const finalCoords: [number, number][] = [from, ...orderedRoute.map(invaderCoord), to]
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

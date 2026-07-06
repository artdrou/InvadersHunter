import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useRouting } from '../features/routing/hooks/use-routing'
import * as orsClient from '../features/routing/ors-client'
import type { InvaderWithState } from '../features/invaders/types'
import type { FeatureCollection } from 'geojson'

// ── mocks ──────────────────────────────────────────────────────────────────

jest.mock('../features/routing/ors-client', () => ({
  fetchDirections: jest.fn(),
  fetchMatrix: jest.fn(),
}))

const mockFetchDirections = orsClient.fetchDirections as jest.Mock
const mockFetchMatrix     = orsClient.fetchMatrix     as jest.Mock

const EMPTY_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [] },
    properties: { summary: { duration: 600, distance: 2.5 } },
  }],
}

const DIRECTIONS_OK = { geojson: EMPTY_GEOJSON, durationSec: 600, distanceKm: 2.5 }
const MATRIX_4x4   = { durations: [[0, 60, 90, 120], [60, 0, 40, 90], [90, 40, 0, 60], [120, 90, 60, 0]] }

const FROM: [number, number] = [2.33, 48.85]
const TO:   [number, number] = [2.37, 48.87]

function makeInvader(id: number, lng: number, lat: number, captured = false): InvaderWithState {
  return {
    id, name: `INV_${id}`, description: '', state: 'Good',
    longitude: lng, latitude: lat, points: 10,
    date_pose: null, image_url: null,
    isCaptured: captured, isPending: false,
  }
}

const INV_A = makeInvader(1, 2.34, 48.85)
const INV_B = makeInvader(2, 2.36, 48.87)

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ── initial state ──────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts with route=null, loading=false, error=null', () => {
    const { result } = renderHook(() => useRouting())
    expect(result.current.route).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

// ── clearRoute ─────────────────────────────────────────────────────────────

describe('clearRoute', () => {
  it('resets route and error to null', async () => {
    mockFetchDirections.mockResolvedValue(DIRECTIONS_OK)

    const { result } = renderHook(() => useRouting())

    act(() => {
      result.current.computeRoute({ mode: 'ab', from: FROM, to: TO, invaders: [], mandatoryInvaders: [], travelMode: 'foot-walking', detourMin: 0 })
    })
    await act(async () => { jest.advanceTimersByTime(500) })
    await waitFor(() => expect(result.current.route).not.toBeNull())

    act(() => { result.current.clearRoute() })
    expect(result.current.route).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

// ── error handling ─────────────────────────────────────────────────────────

describe('error handling', () => {
  it('sets error message when ORS throws', async () => {
    mockFetchDirections.mockRejectedValue(new Error('ORS error 500'))

    const { result } = renderHook(() => useRouting())

    act(() => {
      result.current.computeRoute({ mode: 'ab', from: FROM, to: TO, invaders: [], mandatoryInvaders: [], travelMode: 'foot-walking', detourMin: 0 })
    })
    await act(async () => { jest.advanceTimersByTime(500) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('ORS error 500')
    expect(result.current.route).toBeNull()
  })

  it('clears previous error on a new successful call', async () => {
    mockFetchDirections
      .mockRejectedValueOnce(new Error('ORS error 500'))
      .mockResolvedValue(DIRECTIONS_OK)

    const { result } = renderHook(() => useRouting())

    // First call — fails
    act(() => {
      result.current.computeRoute({ mode: 'ab', from: FROM, to: TO, invaders: [], mandatoryInvaders: [], travelMode: 'foot-walking', detourMin: 0 })
    })
    await act(async () => { jest.advanceTimersByTime(500) })
    await waitFor(() => expect(result.current.error).not.toBeNull())

    // Second call — succeeds
    act(() => {
      result.current.computeRoute({ mode: 'ab', from: FROM, to: TO, invaders: [], mandatoryInvaders: [], travelMode: 'foot-walking', detourMin: 0 })
    })
    await act(async () => { jest.advanceTimersByTime(500) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.route).not.toBeNull()
  })
})

// ── debounce ───────────────────────────────────────────────────────────────

describe('debounce', () => {
  it('only executes once when called multiple times within 500ms', async () => {
    mockFetchDirections.mockResolvedValue(DIRECTIONS_OK)

    const { result } = renderHook(() => useRouting())
    const params = { mode: 'ab' as const, from: FROM, to: TO, invaders: [], mandatoryInvaders: [], travelMode: 'foot-walking' as const, detourMin: 0 }

    act(() => {
      result.current.computeRoute(params)
      result.current.computeRoute(params)
      result.current.computeRoute(params)
    })
    await act(async () => { jest.advanceTimersByTime(500) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    // fetchDirections called once, not three times
    expect(mockFetchDirections).toHaveBeenCalledTimes(1)
  })
})

// ── mode ab with mandatory stops ────────────────────────────────────────────

describe('mode ab with mandatory invaders', () => {
  it('returns route including mandatory stops in orderedInvaders', async () => {
    mockFetchDirections.mockResolvedValue(DIRECTIONS_OK)
    mockFetchMatrix.mockResolvedValue(MATRIX_4x4)

    const { result } = renderHook(() => useRouting())

    act(() => {
      result.current.computeRoute({ mode: 'ab', from: FROM, to: TO, invaders: [], mandatoryInvaders: [INV_A, INV_B], travelMode: 'foot-walking', detourMin: 60 })
    })
    await act(async () => { jest.advanceTimersByTime(500) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.route).not.toBeNull()
    expect(result.current.route!.orderedInvaders).toHaveLength(2)
    expect(result.current.route!.totalMinutes).toBe(10)   // 600s / 60
    expect(result.current.route!.totalKm).toBe(2.5)
    expect(result.current.error).toBeNull()
  })

  it('sets loading=true during computation then false after', async () => {
    let resolveMatrix!: (v: typeof MATRIX_4x4) => void
    mockFetchDirections.mockResolvedValue(DIRECTIONS_OK)
    mockFetchMatrix.mockReturnValue(new Promise((r) => { resolveMatrix = r }))

    const { result } = renderHook(() => useRouting())

    act(() => {
      result.current.computeRoute({ mode: 'ab', from: FROM, to: TO, invaders: [], mandatoryInvaders: [INV_A, INV_B], travelMode: 'foot-walking', detourMin: 60 })
    })
    await act(async () => { jest.advanceTimersByTime(500) })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveMatrix(MATRIX_4x4)
      mockFetchDirections.mockResolvedValue(DIRECTIONS_OK)
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})

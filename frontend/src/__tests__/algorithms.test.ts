import { bboxFilter, nearestNeighborTSP, optimalInsertion } from '../features/routing/algorithms'
import type { InvaderWithState } from '../features/invaders/types'

function makeInvader(id: number, lng: number, lat: number): InvaderWithState {
  return {
    id,
    name: `INV_${id}`,
    description: '',
    state: 'Good',
    longitude: lng,
    latitude: lat,
    points: 10,
    date_pose: null,
    image_url: null,
    isCaptured: false,
    isPending: false,
  }
}

// ── bboxFilter ─────────────────────────────────────────────────────────────

describe('bboxFilter', () => {
  const from: [number, number] = [2.30, 48.80]
  const to:   [number, number] = [2.40, 48.90]

  it('keeps invaders inside the bbox', () => {
    const inv = makeInvader(1, 2.35, 48.85)
    expect(bboxFilter([inv], from, to)).toHaveLength(1)
  })

  it('excludes invaders clearly outside the bbox', () => {
    const inv = makeInvader(1, 3.00, 49.50)
    expect(bboxFilter([inv], from, to)).toHaveLength(0)
  })

  it('includes invaders within the 50% margin expansion', () => {
    // raw bbox: lng [2.30,2.40] lat [48.80,48.90], margin 50% → dLng=0.05 dLat=0.05
    // so lng ≥ 2.25 and lat ≥ 48.75
    const inv = makeInvader(1, 2.26, 48.76)
    expect(bboxFilter([inv], from, to)).toHaveLength(1)
  })

  it('excludes invaders clearly beyond the margin', () => {
    const inv = makeInvader(1, 2.00, 48.50)
    expect(bboxFilter([inv], from, to)).toHaveLength(0)
  })

  it('applies the minimum absolute margin when from and to are very close', () => {
    // from ≈ to — raw bbox is ~0, but MIN_MARGIN_DEG (0.01) should keep nearby invaders
    const close: [number, number] = [2.3500, 48.8500]
    const inv = makeInvader(1, 2.3590, 48.8590) // ~0.009° away, within 0.01 floor
    expect(bboxFilter([inv], close, close)).toHaveLength(1)
  })

  it('excludes invaders with null coordinates', () => {
    const inv = { ...makeInvader(1, 2.35, 48.85), longitude: null, latitude: null }
    expect(bboxFilter([inv], from, to)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(bboxFilter([], from, to)).toHaveLength(0)
  })

  it('works when from and to are the same point (zero-size bbox)', () => {
    const same: [number, number] = [2.35, 48.85]
    const inv = makeInvader(1, 2.35, 48.85)
    expect(bboxFilter([inv], same, same, 0)).toHaveLength(1)
  })
})

// ── nearestNeighborTSP ─────────────────────────────────────────────────────

describe('nearestNeighborTSP', () => {
  it('returns empty array for empty input', () => {
    expect(nearestNeighborTSP([], [])).toEqual([])
  })

  it('returns [0] for a single invader', () => {
    const inv = [makeInvader(1, 2.35, 48.85)]
    expect(nearestNeighborTSP(inv, [[0]])).toEqual([0])
  })

  it('visits all invaders exactly once', () => {
    const invaders = [
      makeInvader(1, 2.30, 48.80),
      makeInvader(2, 2.35, 48.85),
      makeInvader(3, 2.40, 48.90),
    ]
    const durations = [
      [0,  60, 120],
      [60,  0,  60],
      [120, 60,  0],
    ]
    const order = nearestNeighborTSP(invaders, durations)
    expect(order).toHaveLength(3)
    expect(new Set(order).size).toBe(3)
  })

  it('always picks the nearest unvisited next', () => {
    // From 0: nearest is 1 (dur=10), then from 1: nearest unvisited is 2 (dur=10)
    const invaders = [makeInvader(1, 0, 0), makeInvader(2, 0, 0), makeInvader(3, 0, 0)]
    const durations = [
      [0,  10, 100],
      [10,  0,  10],
      [100, 10,  0],
    ]
    expect(nearestNeighborTSP(invaders, durations, 0)).toEqual([0, 1, 2])
  })

  it('respects the startIndex parameter', () => {
    const invaders = [makeInvader(1, 0, 0), makeInvader(2, 0, 0), makeInvader(3, 0, 0)]
    const durations = [
      [0,  100, 10],
      [100,  0, 10],
      [10,  10,  0],
    ]
    const order = nearestNeighborTSP(invaders, durations, 2)
    expect(order[0]).toBe(2)
  })
})

// ── optimalInsertion ───────────────────────────────────────────────────────

describe('optimalInsertion', () => {
  it('finds the cheapest insertion position', () => {
    // Route: [A, B, C] (indices 0,1,2), candidate = index 3
    // Segment A→B costs 100, B→C costs 100
    // Inserting between A and B: A→cand(10) + cand→B(10) - A→B(100) = -80 (cheapest)
    // Inserting between B and C: B→cand(50) + cand→C(50) - B→C(100) = 0
    const dur: Record<string, number> = {
      '0-1': 100, '1-2': 100,
      '0-3': 10,  '3-1': 10,
      '1-3': 50,  '3-2': 50,
    }
    const getDuration = (from: number, to: number) => dur[`${from}-${to}`] ?? 0
    const { insertAt, extraSec } = optimalInsertion(3, 3, getDuration)
    expect(insertAt).toBe(1)
    expect(extraSec).toBe(-80)
  })

  it('returns insertAt=1 for a two-point route', () => {
    // Route has 2 points (from, to), only one segment to test
    const getDuration = (_from: number, _to: number) => 50
    const { insertAt } = optimalInsertion(2, 2, getDuration)
    expect(insertAt).toBe(1)
  })
})

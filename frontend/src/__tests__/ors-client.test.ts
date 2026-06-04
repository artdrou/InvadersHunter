import { fetchDirections, fetchMatrix } from '../features/routing/ors-client'

const COORDS: [number, number][] = [[2.35, 48.85], [2.36, 48.86]]

const MOCK_DIRECTIONS = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: COORDS },
    properties: { summary: { duration: 300, distance: 1.2 } },
  }],
}

const MOCK_MATRIX = {
  durations: [[0, 120], [130, 0]],
}

function mockResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response)
}

let fetchSpy: jest.SpyInstance

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch').mockReset()
})

afterEach(() => {
  fetchSpy.mockRestore()
})

// ── fetchDirections ────────────────────────────────────────────────────────

describe('fetchDirections', () => {
  it('returns parsed duration, distance and geojson', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse(MOCK_DIRECTIONS))
    const result = await fetchDirections('foot-walking', COORDS)
    expect(result.durationSec).toBe(300)
    expect(result.distanceKm).toBe(1.2)
    expect(result.geojson.type).toBe('FeatureCollection')
  })

  it('calls the correct profile in the URL', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse(MOCK_DIRECTIONS))
    await fetchDirections('cycling-regular', COORDS)
    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain('/cycling-regular/')
  })

  it('sends coordinates as [lng, lat] in request body', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse(MOCK_DIRECTIONS))
    await fetchDirections('foot-walking', COORDS)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.coordinates).toEqual(COORDS)
  })

  it('retries once on 429 then succeeds', async () => {
    jest.useFakeTimers()
    fetchSpy
      .mockReturnValueOnce(mockResponse(null, 429))
      .mockReturnValueOnce(mockResponse(MOCK_DIRECTIONS))

    const promise = fetchDirections('foot-walking', COORDS)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result.durationSec).toBe(300)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })

  it('throws immediately on non-429 error without retry', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse('not found', 404))
    await expect(fetchDirections('foot-walking', COORDS)).rejects.toThrow('ORS error 404')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('throws after two consecutive 429s', async () => {
    jest.useFakeTimers()
    fetchSpy
      .mockReturnValueOnce(mockResponse(null, 429))
      .mockReturnValueOnce(mockResponse(null, 429))

    const promise = fetchDirections('foot-walking', COORDS)
    // Register the rejection handler BEFORE advancing timers to avoid unhandled-rejection warning
    const assertion = expect(promise).rejects.toThrow('ORS rate limit exceeded')
    await jest.runAllTimersAsync()
    await assertion
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })
})

// ── fetchMatrix ────────────────────────────────────────────────────────────

describe('fetchMatrix', () => {
  it('returns the durations matrix', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse(MOCK_MATRIX))
    const result = await fetchMatrix('foot-walking', COORDS)
    expect(result.durations).toEqual([[0, 120], [130, 0]])
  })

  it('includes sources and destinations when provided', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse(MOCK_MATRIX))
    await fetchMatrix('foot-walking', COORDS, [0], [1])
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.sources).toEqual([0])
    expect(body.destinations).toEqual([1])
  })

  it('omits sources and destinations when not provided', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse(MOCK_MATRIX))
    await fetchMatrix('foot-walking', COORDS)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.sources).toBeUndefined()
    expect(body.destinations).toBeUndefined()
  })

  it('includes duration metric and km unit in request', async () => {
    fetchSpy.mockReturnValueOnce(mockResponse(MOCK_MATRIX))
    await fetchMatrix('foot-walking', COORDS)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.metrics).toContain('duration')
    expect(body.units).toBe('km')
  })
})

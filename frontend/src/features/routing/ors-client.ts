import type { FeatureCollection } from 'geojson'
import type { TravelMode } from './types'

const ORS_BASE = 'https://api.openrouteservice.org'

function apiKey(): string {
  return process.env.EXPO_PUBLIC_ORS_KEY ?? ''
}

type FetchBody = Record<string, unknown>

class OrsRateLimitError extends Error {
  readonly status = 429
  constructor() {
    super('ORS rate limit exceeded')
  }
}

async function orsPost(path: string, body: FetchBody): Promise<unknown> {
  const attempt = async () => {
    const res = await fetch(`${ORS_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: apiKey(),
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
      },
      body: JSON.stringify(body),
    })
    if (res.status === 429) throw new OrsRateLimitError()
    if (!res.ok) throw new Error(`ORS error ${res.status}: ${await res.text()}`)
    return res.json()
  }

  try {
    return await attempt()
  } catch (err) {
    if (err instanceof OrsRateLimitError) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
      return attempt()
    }
    throw err
  }
}

export type DirectionsResult = {
  geojson: FeatureCollection
  durationSec: number
  distanceKm: number
}

export async function fetchDirections(
  profile: TravelMode,
  coordinates: [number, number][],
): Promise<DirectionsResult> {
  const data = (await orsPost(`/v2/directions/${profile}/geojson`, {
    coordinates,
    units: 'km',
  })) as any

  const summary = data.features[0].properties.summary
  return {
    geojson: data as FeatureCollection,
    durationSec: summary.duration,
    distanceKm: summary.distance,
  }
}

export type MatrixResult = {
  durations: number[][]
}

export async function fetchMatrix(
  profile: TravelMode,
  locations: [number, number][],
  sources?: number[],
  destinations?: number[],
): Promise<MatrixResult> {
  const body: FetchBody = { locations, metrics: ['duration'], units: 'km' }
  if (sources !== undefined) body.sources = sources
  if (destinations !== undefined) body.destinations = destinations

  const data = (await orsPost(`/v2/matrix/${profile}`, body)) as any
  return { durations: data.durations }
}

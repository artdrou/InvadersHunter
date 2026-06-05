import type { FeatureCollection } from 'geojson'
import type { InvaderWithState } from '../invaders/types'

export type TravelMode = 'foot-walking' | 'cycling-regular' | 'cycling-road'

export type RouteResult = {
  geojson: FeatureCollection
  orderedInvaders: InvaderWithState[]
  totalMinutes: number
  totalKm: number
  detourMinutes?: number
}

export type RoutingParams =
  | {
      mode: 'ab'
      from: [number, number]
      to: [number, number]
      invaders: InvaderWithState[]
      travelMode: TravelMode
      detourMin: number
    }
  | {
      mode: 'multi'
      from?: [number, number]
      invaders: InvaderWithState[]
      travelMode: TravelMode
    }
  | {
      mode: 'walk'
      from: [number, number]
      invaders: InvaderWithState[]
      travelMode: TravelMode
      durationMin: number
      walkMode: 'circuit' | 'libre'
      to?: [number, number]
    }

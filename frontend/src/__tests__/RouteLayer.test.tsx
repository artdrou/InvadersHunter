import React from 'react'
import { render } from '@testing-library/react-native'
import { RouteLayer } from '../features/routing/components/RouteLayer'
import type { RouteResult } from '../features/routing/types'
import type { InvaderWithState } from '../features/invaders/types'
import type { FeatureCollection } from 'geojson'

// MapLibre uses native modules — stub them all as plain Views
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View, Text } = require('react-native')
  return {
    ShapeSource:     ({ children }: any) => <View testID="ShapeSource">{children}</View>,
    LineLayer:       (props: any) => <View testID="LineLayer" {...props} />,
    PointAnnotation: ({ children, id }: any) => <View testID={`PointAnnotation-${id}`}>{children}</View>,
    Callout:         ({ title }: any) => <Text testID="Callout">{title}</Text>,
  }
})

// ── helpers ────────────────────────────────────────────────────────────────

const GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[2.35, 48.85], [2.36, 48.86]] },
    properties: {},
  }],
}

function makeInvader(id: number, lng: number | null = 2.35, lat: number | null = 48.85): InvaderWithState {
  return {
    id, name: `INV_${id}`, description: '', state: 'Good',
    longitude: lng, latitude: lat, points: 10,
    date_pose: null, image_url: null,
    isCaptured: false, isPending: false,
  }
}

function makeRoute(invaders: InvaderWithState[]): RouteResult {
  return {
    geojson: GEOJSON,
    orderedInvaders: invaders,
    totalMinutes: 10,
    totalKm: 1.5,
  }
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('RouteLayer', () => {
  it('renders a ShapeSource and LineLayer for the route', () => {
    const { getByTestId } = render(
      <RouteLayer route={makeRoute([])} travelMode="foot-walking" />
    )
    expect(getByTestId('ShapeSource')).toBeTruthy()
    expect(getByTestId('LineLayer')).toBeTruthy()
  })

  it('renders one PointAnnotation per ordered invader', () => {
    const invaders = [makeInvader(1), makeInvader(2), makeInvader(3)]
    const { getByTestId } = render(
      <RouteLayer route={makeRoute(invaders)} travelMode="foot-walking" />
    )
    expect(getByTestId('PointAnnotation-route-wp-1')).toBeTruthy()
    expect(getByTestId('PointAnnotation-route-wp-2')).toBeTruthy()
    expect(getByTestId('PointAnnotation-route-wp-3')).toBeTruthy()
  })

  it('skips invaders with null coordinates', () => {
    const invaders = [makeInvader(1), makeInvader(2, null, null)]
    const { queryByTestId } = render(
      <RouteLayer route={makeRoute(invaders)} travelMode="foot-walking" />
    )
    expect(queryByTestId('PointAnnotation-route-wp-1')).toBeTruthy()
    expect(queryByTestId('PointAnnotation-route-wp-2')).toBeNull()
  })

  it('renders no PointAnnotations when orderedInvaders is empty', () => {
    const { queryByTestId } = render(
      <RouteLayer route={makeRoute([])} travelMode="foot-walking" />
    )
    expect(queryByTestId(/PointAnnotation/)).toBeNull()
  })

  it('callout title shows order number and invader name', () => {
    const invaders = [makeInvader(42)]
    const { getAllByTestId } = render(
      <RouteLayer route={makeRoute(invaders)} travelMode="foot-walking" />
    )
    const callouts = getAllByTestId('Callout')
    expect(callouts[0].props.children).toBe('1. INV_42')
  })
})

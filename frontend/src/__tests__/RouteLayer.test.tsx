import React from 'react'
import { render } from '@testing-library/react-native'
import { RouteLayer } from '../features/routing/components/RouteLayer'
import type { RouteResult } from '../features/routing/types'
import type { InvaderWithState } from '../features/invaders/types'
import type { FeatureCollection } from 'geojson'

// MapLibre uses native modules — stub them all as plain Views
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native')
  return {
    ShapeSource:     ({ children }: any) => <View testID="ShapeSource">{children}</View>,
    LineLayer:       (props: any) => <View testID="LineLayer" {...props} />,
    CircleLayer:     (props: any) => <View testID="CircleLayer" {...props} />,
    SymbolLayer:     (props: any) => <View testID="SymbolLayer" {...props} />,
    PointAnnotation: ({ children, id }: any) => <View testID={`PointAnnotation-${id}`}>{children}</View>,
  }
})

// constants/theme imports global.css — stub the whole module
jest.mock('@/constants/theme', () => ({
  ButtonFont: 'System',
  ButtonFontSize: { xs: 10, xl: 18 },
}))

// Theme context re-exports theme tokens — stub to avoid indirect CSS import
jest.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({
    theme: {
      routePath: '#00bfff',
      bg: '#000000',
      accent: '#00ff99',
      danger: '#ff3366',
    },
    appFont: 'System',
    fontScale: 1,
    themeName: 'dark',
  }),
}))

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
  it('renders ShapeSources and a LineLayer for the route', () => {
    const { getAllByTestId } = render(
      <RouteLayer route={makeRoute([])}  />
    )
    expect(getAllByTestId('ShapeSource').length).toBeGreaterThanOrEqual(1)
    expect(getAllByTestId('LineLayer').length).toBeGreaterThanOrEqual(1)
  })

  it('renders one PointAnnotation per ordered invader', () => {
    const invaders = [makeInvader(1), makeInvader(2), makeInvader(3)]
    const { getByTestId } = render(
      <RouteLayer route={makeRoute(invaders)}  />
    )
    expect(getByTestId('PointAnnotation-route-wp-1')).toBeTruthy()
    expect(getByTestId('PointAnnotation-route-wp-2')).toBeTruthy()
    expect(getByTestId('PointAnnotation-route-wp-3')).toBeTruthy()
  })

  it('skips invaders with null coordinates', () => {
    const invaders = [makeInvader(1), makeInvader(2, null, null)]
    const { queryByTestId } = render(
      <RouteLayer route={makeRoute(invaders)}  />
    )
    expect(queryByTestId('PointAnnotation-route-wp-1')).toBeTruthy()
    expect(queryByTestId('PointAnnotation-route-wp-2')).toBeNull()
  })

  it('renders no PointAnnotations when orderedInvaders is empty', () => {
    const { queryByTestId } = render(
      <RouteLayer route={makeRoute([])}  />
    )
    expect(queryByTestId(/PointAnnotation/)).toBeNull()
  })

  it('waypoint badge shows the 1-based order number', () => {
    const invaders = [makeInvader(42)]
    const { getByText } = render(
      <RouteLayer route={makeRoute(invaders)}  />
    )
    expect(getByText('1')).toBeTruthy()
  })
})

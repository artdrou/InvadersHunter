import { StyleSheet, Text, View } from 'react-native'
import { ShapeSource, LineLayer, PointAnnotation, Callout } from '@maplibre/maplibre-react-native'
import type { RouteResult, TravelMode } from '../types'

const LINE_COLOR: Record<TravelMode, string> = {
  'foot-walking':    '#3effa0',
  'cycling-regular': '#3eb5ff',
  'cycling-road':    '#3eb5ff',
}

type Props = {
  route: RouteResult
  travelMode: TravelMode
}

export function RouteLayer({ route, travelMode }: Props) {
  const lineColor = LINE_COLOR[travelMode]

  return (
    <>
      <ShapeSource id="ors-route" shape={route.geojson}>
        <LineLayer
          id="ors-route-line"
          style={{
            lineColor,
            lineWidth: 4,
            lineOpacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </ShapeSource>

      {route.orderedInvaders.map((inv, index) => {
        if (inv.longitude == null || inv.latitude == null) return null
        const order = index + 1
        return (
          <PointAnnotation
            key={`route-wp-${inv.id}`}
            id={`route-wp-${inv.id}`}
            coordinate={[inv.longitude, inv.latitude]}
            title={inv.name}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{order}</Text>
            </View>
            <Callout title={`${order}. ${inv.name}`} />
          </PointAnnotation>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffd000',
    borderWidth: 2,
    borderColor: '#000',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
})

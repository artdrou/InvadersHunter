import { StyleSheet, Text, View } from 'react-native'
import { ShapeSource, LineLayer, PointAnnotation, Callout } from '@maplibre/maplibre-react-native'
import { useTheme } from '@/contexts/theme-context'
import { ButtonFont, ButtonFontSize } from '@/constants/theme'
import type { RouteResult } from '../types'

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Zoom-interpolated width expression for MapLibre.
// breakpoints: [[zoom, width], ...]
function zoomWidth(breakpoints: [number, number][]): unknown[] {
  const stops = breakpoints.flatMap(([z, w]) => [z, w])
  return ['interpolate', ['linear'], ['zoom'], ...stops]
}

type Props = {
  route: RouteResult
}

export function RouteLayer({ route }: Props) {
  const { theme } = useTheme()
  const color = theme.routePath

  return (
    <>
      <ShapeSource id="ors-route" shape={route.geojson}>
        {/* Layer 1 — outer bloom: wide halo */}
        <LineLayer
          id="ors-route-bloom"
          style={{
            lineColor: hexToRgba(color, 0.12),
            lineWidth: zoomWidth([[10, 12], [14, 28], [17, 48]]),
            lineBlur: 12,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
        {/* Layer 2 — inner glow */}
        <LineLayer
          id="ors-route-glow"
          style={{
            lineColor: hexToRgba(color, 0.28),
            lineWidth: zoomWidth([[10, 7], [14, 16], [17, 28]]),
            lineBlur: 5,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
        {/* Layer 3 — main line */}
        <LineLayer
          id="ors-route-line"
          style={{
            lineColor: color,
            lineWidth: zoomWidth([[10, 2.5], [14, 6], [17, 10]]),
            lineOpacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
        {/* Layer 4 — white hot core (neon inner highlight) */}
        <LineLayer
          id="ors-route-white"
          style={{
            lineColor: 'rgba(255,255,255,0.65)',
            lineWidth: zoomWidth([[10, 1], [14, 2.5], [17, 4]]),
            lineBlur: 1,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
      </ShapeSource>

      {route.orderedInvaders.map((inv, index) => {
        if (inv.longitude == null || inv.latitude == null) return null
        return (
          <PointAnnotation
            key={`route-wp-${inv.id}`}
            id={`route-wp-${inv.id}`}
            coordinate={[inv.longitude, inv.latitude]}
            title={inv.name}
          >
            <View style={[styles.badge, { backgroundColor: color, borderColor: theme.bg }]}>
              <Text style={[styles.badgeText, { color: theme.bg }]}>{index + 1}</Text>
            </View>
            <Callout title={`${index + 1}. ${inv.name}`} />
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
    borderWidth: 2,
  },
  badgeText: {
    fontFamily: ButtonFont,
    fontSize: ButtonFontSize.xs,
  },
})

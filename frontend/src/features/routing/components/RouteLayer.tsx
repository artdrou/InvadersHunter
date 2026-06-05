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

// Blend hex color toward white. amount=0 → original, amount=1 → pure white.
// Returns a hex string so it stays compatible with hexToRgba.
function lightenColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const r = Math.round(parseInt(full.slice(0, 2), 16) + (255 - parseInt(full.slice(0, 2), 16)) * amount)
  const g = Math.round(parseInt(full.slice(2, 4), 16) + (255 - parseInt(full.slice(2, 4), 16)) * amount)
  const b = Math.round(parseInt(full.slice(4, 6), 16) + (255 - parseInt(full.slice(4, 6), 16)) * amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Zoom-interpolated width expression for MapLibre.
function zoomWidth(breakpoints: [number, number][]): unknown[] {
  return ['interpolate', ['linear'], ['zoom'], ...breakpoints.flatMap(([z, w]) => [z, w])]
}

type Props = {
  route: RouteResult
}

export function RouteLayer({ route }: Props) {
  const { theme } = useTheme()
  const color = theme.routePath
  // Tinted inner core: blend 70% toward white so it echoes the path color
  const coreColor = lightenColor(color, 0.70)

  return (
    <>
      <ShapeSource id="ors-route" shape={route.geojson}>
        {/* Layer 1 — outer bloom: diffuse halo */}
        <LineLayer
          id="ors-route-bloom"
          style={{
            lineColor: hexToRgba(color, 0.12),
            lineWidth: zoomWidth([[10, 16], [14, 42], [17, 72]]),
            lineBlur: 12,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
        {/* Layer 2 — inner glow */}
        <LineLayer
          id="ors-route-glow"
          style={{
            lineColor: hexToRgba(color, 0.30),
            lineWidth: zoomWidth([[10, 9], [14, 22], [17, 38]]),
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
            lineWidth: zoomWidth([[10, 3], [14, 8], [17, 15]]),
            lineOpacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
        {/* Layer 4 — tinted core: subtle neon highlight mixed with path color */}
        <LineLayer
          id="ors-route-core"
          style={{
            lineColor: hexToRgba(coreColor, 0.40),
            lineWidth: zoomWidth([[10, 1.5], [14, 4], [17, 7]]),
            lineBlur: 1.5,
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

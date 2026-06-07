import { useState, useEffect, useRef } from 'react'
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

function zoomWidth(breakpoints: [number, number][]): unknown[] {
  return ['interpolate', ['linear'], ['zoom'], ...breakpoints.flatMap(([z, w]) => [z, w])]
}

// Builds a lineGradient expression for a traveling shimmer point.
// Long fade-in behind the peak, short fade-out ahead — gives a directional feel.
function buildShimmerGradient(p: number, peak: string, fade: string): unknown[] {
  const W_BACK  = 0.14   // long trailing wake
  const W_FRONT = 0.06   // short leading edge
  const EPS     = 0.004  // minimum gap between stops

  const back   = Math.max(EPS,       p - W_BACK)
  const front  = Math.min(1 - EPS,   p + W_FRONT)
  const center = Math.max(back + EPS, Math.min(front - EPS, p))

  // [pos, color] pairs — deduplicate consecutive identical positions
  const raw: (number | string)[] = [0, fade, back, fade, center, peak, front, fade, 1, fade]
  const out: (number | string)[] = []
  for (let i = 0; i < raw.length; i += 2) {
    if (out.length === 0 || (out[out.length - 2] as number) !== (raw[i] as number)) {
      out.push(raw[i], raw[i + 1])
    }
  }
  return ['interpolate', ['linear'], ['line-progress'], ...out]
}

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const SHIMMER_CYCLE_MS = 2800
const SHIMMER_FPS_MS   = 50   // ~20 fps

type Props = {
  route: RouteResult | null
}

export function RouteLayer({ route }: Props) {
  const { theme } = useTheme()
  const color     = theme.routePath
  const coreColor = lightenColor(color, 0.70)
  const fade      = hexToRgba(color, 0)

  const [shimmer, setShimmer] = useState(0)
  const tRef = useRef(0)

  useEffect(() => {
    if (!route) { tRef.current = 0; setShimmer(0); return }
    const id = setInterval(() => {
      tRef.current = (tRef.current + SHIMMER_FPS_MS / SHIMMER_CYCLE_MS) % 1
      setShimmer(tRef.current)
    }, SHIMMER_FPS_MS)
    return () => clearInterval(id)
  }, [!!route]) // eslint-disable-line react-hooks/exhaustive-deps

  // Three gradient levels: outer halo (wide+heavy blur) · mid glow · bright core
  const gradHalo = buildShimmerGradient(shimmer, hexToRgba(color, 0.50), fade)
  const gradMid  = buildShimmerGradient(shimmer, hexToRgba(color, 0.85), fade)
  const gradCore = buildShimmerGradient(shimmer, '#ffffff', fade)

  return (
    <>
      {/* lineMetrics required for lineGradient / line-progress expressions */}
      <ShapeSource id="ors-route" shape={route?.geojson ?? EMPTY_COLLECTION} lineMetrics>
        {/* ── Static base ── */}
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
        <LineLayer
          id="ors-route-core"
          style={{
            lineColor: hexToRgba(coreColor, 0.45),
            lineWidth: zoomWidth([[10, 1.5], [14, 4], [17, 7]]),
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />

        {/* ── Animated shimmer (always mounted; no-ops on empty source) ── */}
        {/* Outer halo — wide, heavy blur, low opacity */}
        <LineLayer
          id="ors-shimmer-halo"
          style={{
            lineGradient: gradHalo,
            lineWidth: zoomWidth([[10, 20], [14, 34], [17, 48]]),
            lineBlur: 10,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
        {/* Mid glow — medium width, moderate blur */}
        <LineLayer
          id="ors-shimmer-mid"
          style={{
            lineGradient: gradMid,
            lineWidth: zoomWidth([[10, 8], [14, 14], [17, 20]]),
            lineBlur: 3,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
        {/* Core — narrow, barely blurred, pure white */}
        <LineLayer
          id="ors-shimmer-core"
          style={{
            lineGradient: gradCore,
            lineWidth: zoomWidth([[10, 2], [14, 3.5], [17, 5]]),
            lineBlur: 0.6,
            lineCap: 'round',
            lineJoin: 'round',
          } as any}
        />
      </ShapeSource>

      {route?.orderedInvaders.map((inv, index) => {
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

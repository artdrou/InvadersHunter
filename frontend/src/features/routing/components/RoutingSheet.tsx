import { useState } from 'react'
import {
  Modal, View, Text, Pressable, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/theme-context'
import type { ThemeTokens } from '@/constants/theme'
import { BorderRadius, Spacing, ButtonFont, ButtonFontSize } from '@/constants/theme'
import type { InvaderWithState } from '@/features/invaders/types'
import type { RoutingParams, RouteResult, TravelMode } from '../types'

type SheetMode = 'ab' | 'walk' | 'multi'

type Props = {
  visible: boolean
  onClose: () => void
  /** Pre-selected destination (set from InvaderPopup). */
  targetInvader?: InvaderWithState | null
  allInvaders: InvaderWithState[]
  multiInvaders: InvaderWithState[]
  onRemoveFromMulti: (id: number) => void
  loading: boolean
  error: string | null
  route: RouteResult | null
  onCompute: (params: RoutingParams) => void
  onClear: () => void
  /** Coordinates of the user — obtained via mapRef.getUserCoords() before opening. */
  userLocation: [number, number] | null
  /** Default mode when opened from InvaderPopup. */
  initialMode?: SheetMode
}

export function RoutingSheet({
  visible, onClose,
  targetInvader, allInvaders, multiInvaders, onRemoveFromMulti,
  loading, error, route,
  onCompute, onClear,
  userLocation, initialMode = 'ab',
}: Props) {
  const { theme, appFont } = useTheme()
  const s = makeStyles(theme, appFont)

  const [mode, setMode]           = useState<SheetMode>(initialMode)
  const [detourPct, setDetourPct] = useState(30)
  const [durationMin, setDurationMin] = useState(30)
  const [walkMode, setWalkMode]   = useState<'circuit' | 'libre'>('circuit')
  const [travelMode, setTravelMode] = useState<TravelMode>('foot-walking')

  function handleCompute() {
    if (!userLocation) return
    const uncaptured = allInvaders.filter(
      (inv) => !inv.isCaptured && inv.latitude != null && inv.longitude != null,
    )

    if (mode === 'ab') {
      if (!targetInvader?.latitude || !targetInvader?.longitude) return
      onCompute({
        mode: 'ab',
        from: userLocation,
        to: [targetInvader.longitude, targetInvader.latitude],
        invaders: uncaptured,
        travelMode,
        detourPct,
      })
    } else if (mode === 'walk') {
      onCompute({
        mode: 'walk',
        from: userLocation,
        invaders: uncaptured,
        travelMode,
        durationMin,
        walkMode,
        ...(walkMode === 'libre' && targetInvader?.latitude != null && targetInvader?.longitude != null
          ? { to: [targetInvader.longitude, targetInvader.latitude] as [number, number] }
          : {}),
      })
    } else {
      if (multiInvaders.length < 2) return
      onCompute({ mode: 'multi', invaders: multiInvaders, travelMode })
    }
  }

  const canCompute = (() => {
    if (!userLocation) return false
    if (loading) return false
    if (mode === 'ab') return !!(targetInvader?.latitude && targetInvader?.longitude)
    if (mode === 'walk') return walkMode === 'circuit' || !!(targetInvader?.latitude)
    return multiInvaders.length >= 2
  })()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />

      <View style={[s.sheet, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
        <View style={[s.handle, { backgroundColor: theme.bgDivider }]} />

        {/* Mode tabs */}
        <View style={[s.tabs, { borderBottomColor: theme.bgDivider }]}>
          {(['ab', 'walk', 'multi'] as SheetMode[]).map((m) => (
            <Pressable
              key={m}
              style={[s.tab, mode === m && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
              onPress={() => setMode(m)}
            >
              <Text style={[s.tabText, { color: mode === m ? theme.accent : theme.textMuted, fontFamily: appFont }]}>
                {m === 'ab' ? 'A → B' : m === 'walk' ? 'Balade' : 'Multi'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={s.body} showsVerticalScrollIndicator={false} contentContainerStyle={s.bodyContent}>

          {/* Target invader chip */}
          {targetInvader && (mode === 'ab' || (mode === 'walk' && walkMode === 'libre')) && (
            <View style={[s.chip, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="location" size={13} color={theme.accent} />
              <Text style={[s.chipText, { color: theme.text }]} numberOfLines={1}>
                {mode === 'ab' ? `Vers ${targetInvader.name}` : `Libre → ${targetInvader.name}`}
              </Text>
            </View>
          )}

          {/* Travel mode */}
          <Text style={[s.label, { color: theme.textMuted }]}>Transport</Text>
          <View style={s.pillRow}>
            {(['foot-walking', 'cycling-regular'] as TravelMode[]).map((tm) => (
              <Pressable
                key={tm}
                style={[s.pill, { borderColor: theme.border }, travelMode === tm && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                onPress={() => setTravelMode(tm)}
              >
                <Ionicons
                  name={tm === 'foot-walking' ? 'walk' : 'bicycle'}
                  size={18}
                  color={travelMode === tm ? theme.bg : theme.textMuted}
                />
              </Pressable>
            ))}
          </View>

          {/* A→B — detour % */}
          {mode === 'ab' && (
            <>
              <Text style={[s.label, { color: theme.textMuted }]}>Détour max</Text>
              <View style={s.stepper}>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDetourPct(Math.max(10, detourPct - 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
                </Pressable>
                <Text style={[s.stepValue, { color: theme.text, fontFamily: appFont }]}>{detourPct}%</Text>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDetourPct(Math.min(100, detourPct + 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Walk — duration + type */}
          {mode === 'walk' && (
            <>
              <Text style={[s.label, { color: theme.textMuted }]}>Durée</Text>
              <View style={s.stepper}>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDurationMin(Math.max(10, durationMin - 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
                </Pressable>
                <Text style={[s.stepValue, { color: theme.text, fontFamily: appFont }]}>{durationMin} min</Text>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDurationMin(Math.min(180, durationMin + 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[s.label, { color: theme.textMuted }]}>Type</Text>
              <View style={s.pillRow}>
                {(['circuit', 'libre'] as const).map((wm) => (
                  <Pressable
                    key={wm}
                    style={[s.pillWide, { borderColor: theme.border }, walkMode === wm && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => setWalkMode(wm)}
                  >
                    <Text style={[s.pillText, { color: walkMode === wm ? theme.bg : theme.textMuted, fontFamily: appFont }]}>
                      {wm === 'circuit' ? 'Circuit' : 'Libre'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Multi — selected list */}
          {mode === 'multi' && (
            <>
              <Text style={[s.label, { color: theme.textMuted }]}>
                {multiInvaders.length === 0
                  ? 'Aucun invader sélectionné'
                  : `${multiInvaders.length} invader${multiInvaders.length > 1 ? 's' : ''} sélectionné${multiInvaders.length > 1 ? 's' : ''}`}
              </Text>
              {multiInvaders.length === 0 && (
                <Text style={[s.hint, { color: theme.textMuted }]}>
                  Ouvre un invader sur la carte et appuie sur + Multi pour l'ajouter ici.
                </Text>
              )}
              {multiInvaders.map((inv) => (
                <View key={inv.id} style={[s.multiRow, { borderColor: theme.bgDivider }]}>
                  <Text style={[s.multiName, { color: theme.text }]} numberOfLines={1}>{inv.name}</Text>
                  <Pressable onPress={() => onRemoveFromMulti(inv.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {/* Route result summary */}
          {route && (
            <View style={[s.result, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[s.resultText, { color: theme.success }]}>
                {route.orderedInvaders.length} invader{route.orderedInvaders.length !== 1 ? 's' : ''} · {route.totalMinutes} min · {route.totalKm} km
              </Text>
              {route.detourMinutes !== undefined && route.detourMinutes > 0 && (
                <Text style={[s.resultSub, { color: theme.textMuted }]}>
                  +{route.detourMinutes} min de détour
                </Text>
              )}
            </View>
          )}

          {error && <Text style={[s.error, { color: theme.danger }]}>{error}</Text>}
          {!userLocation && (
            <Text style={[s.hint, { color: theme.textMuted }]}>Position GPS non disponible</Text>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {route && (
            <Pressable style={[s.clearBtn, { borderColor: theme.danger }]} onPress={() => { onClear(); onClose() }}>
              <Text style={[s.clearBtnText, { color: theme.danger, fontFamily: appFont }]}>Effacer l'itinéraire</Text>
            </Pressable>
          )}
          <Pressable
            style={[s.computeBtn, { backgroundColor: canCompute ? theme.accent : theme.bgDivider }]}
            onPress={handleCompute}
            disabled={!canCompute}
          >
            {loading
              ? <ActivityIndicator size="small" color={theme.bg} />
              : <Text style={[s.computeBtnText, { color: canCompute ? theme.bg : theme.textMuted, fontFamily: appFont }]}>
                  Calculer l'itinéraire
                </Text>
            }
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(t: ThemeTokens, _font: string) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
    },
    sheet: {
      borderTopLeftRadius: BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
      borderWidth: 1,
      borderBottomWidth: 0,
      maxHeight: '75%',
      paddingBottom: 32,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginVertical: 10,
    },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      marginHorizontal: Spacing.four,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
    },
    body: {
      paddingHorizontal: Spacing.four,
    },
    bodyContent: {
      paddingTop: Spacing.three,
      gap: Spacing.two,
      paddingBottom: Spacing.two,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignSelf: 'flex-start',
    },
    chipText: {
      fontSize: 12,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: Spacing.two,
    },
    pillRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    pill: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillWide: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
    },
    pillText: {
      fontSize: 13,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontSize: 20,
      lineHeight: 24,
    },
    stepValue: {
      fontSize: 16,
      minWidth: 70,
      textAlign: 'center',
    },
    multiRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    multiName: {
      fontSize: 14,
      flex: 1,
      marginRight: 8,
    },
    result: {
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      padding: Spacing.three,
      gap: 4,
      marginTop: Spacing.two,
    },
    resultText: {
      fontSize: 14,
      fontWeight: '600',
    },
    resultSub: {
      fontSize: 12,
    },
    error: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: Spacing.two,
    },
    hint: {
      fontSize: 12,
      lineHeight: 18,
    },
    footer: {
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.three,
      gap: Spacing.two,
    },
    clearBtn: {
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      alignItems: 'center',
    },
    clearBtnText: {
      fontSize: 13,
    },
    computeBtn: {
      borderRadius: BorderRadius.sm,
      paddingVertical: 14,
      alignItems: 'center',
    },
    computeBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
  })
}

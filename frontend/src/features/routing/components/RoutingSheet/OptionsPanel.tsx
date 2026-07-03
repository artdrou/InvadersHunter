import type { Dispatch, SetStateAction } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { ThemeTokens } from '@/constants/theme'
import type { RouteResult } from '../../types'
import type { RoutingStyles } from './styles'
import { fmtMin } from './format'
import { ComputeButton } from './ComputeButton'

// Stepper bounds (minutes).
const DETOUR_MIN = 0
const DETOUR_STEP = 5
const DURATION_MIN = 10
const DURATION_STEP = 10
const MINUTES_MAX = 180

type Props = {
  boucle: boolean
  setBoucle: Dispatch<SetStateAction<boolean>>
  includeCaptures: boolean
  setIncludeCaptures: Dispatch<SetStateAction<boolean>>
  flashableOnly: boolean
  setFlashableOnly: Dispatch<SetStateAction<boolean>>
  detourMin: number
  setDetourMin: Dispatch<SetStateAction<number>>
  durationMin: number
  setDurationMin: Dispatch<SetStateAction<number>>
  route: RouteResult | null
  canCompute: boolean
  loading: boolean
  onCompute: () => void
  onCancel: () => void
  theme: ThemeTokens
  s: RoutingStyles
}

/** Collapsible options: loop/uncaptured/flashable chips, the detour/duration
 *  stepper, and the compute/cancel action button. */
export function OptionsPanel({
  boucle, setBoucle,
  includeCaptures, setIncludeCaptures,
  flashableOnly, setFlashableOnly,
  detourMin, setDetourMin,
  durationMin, setDurationMin,
  route, canCompute, loading, onCompute, onCancel,
  theme, s,
}: Props) {
  const { t } = useTranslation()

  function decrement() {
    if (boucle) setDurationMin((v) => Math.max(DURATION_MIN, v - DURATION_STEP))
    else setDetourMin((v) => Math.max(DETOUR_MIN, v - DETOUR_STEP))
  }
  function increment() {
    if (boucle) setDurationMin((v) => Math.min(MINUTES_MAX, v + DURATION_STEP))
    else setDetourMin((v) => Math.min(MINUTES_MAX, v + DETOUR_STEP))
  }

  return (
    <View style={[s.optionsPanel, { borderTopColor: theme.bgDivider }]}>
      <View style={s.filterRow}>
        <Pressable
          style={({ pressed }) => [s.chip, { borderColor: theme.border }, boucle && s.chipActive, pressed && s.btnPressed]}
          onPress={() => setBoucle((v) => !v)}
        >
          <Ionicons name={boucle ? 'refresh-circle' : 'refresh-circle-outline'} size={13} color={boucle ? theme.bg : theme.textMuted} />
          <Text style={[s.chipText, { color: boucle ? theme.bg : theme.textMuted }]}>{t('routing.loop')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.chip, { borderColor: theme.border }, !includeCaptures && s.chipActive, pressed && s.btnPressed]}
          onPress={() => setIncludeCaptures((v) => !v)}
        >
          <Text style={[s.chipText, { color: !includeCaptures ? theme.bg : theme.textMuted }]}>{t('routing.filterUncaptured')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.chip, { borderColor: theme.border }, flashableOnly && s.chipActive, pressed && s.btnPressed]}
          onPress={() => setFlashableOnly((v) => !v)}
        >
          <Text style={[s.chipText, { color: flashableOnly ? theme.bg : theme.textMuted }]}>{t('routing.filterFlashable')}</Text>
        </Pressable>
      </View>

      <View style={s.stepper}>
        <Pressable style={({ pressed }) => [s.stepBtn, { borderColor: theme.border }, pressed && s.btnPressed]} onPress={decrement}>
          <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
        </Pressable>
        <Text style={[s.stepValue, { color: boucle || detourMin > 0 ? theme.text : theme.accent }]}>
          {boucle ? fmtMin(durationMin) : (detourMin === 0 ? t('routing.detourDirect') : fmtMin(detourMin))}
        </Text>
        <Pressable style={({ pressed }) => [s.stepBtn, { borderColor: theme.border }, pressed && s.btnPressed]} onPress={increment}>
          <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
        </Pressable>
      </View>

      <ComputeButton
        route={route} canCompute={canCompute} loading={loading}
        onCompute={onCompute} onCancel={onCancel}
        alignStart theme={theme} s={s}
      />
    </View>
  )
}

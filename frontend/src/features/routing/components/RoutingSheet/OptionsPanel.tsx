import type { Dispatch, SetStateAction } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { ThemeTokens } from '@/constants/theme'
import { arcadeLabelColor } from '@/constants/arcade-button'
import { ShadowText } from '@/components/ShadowText'
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
  onStart?: () => void
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
  route, canCompute, loading, onCompute, onCancel, onStart,
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
          style={({ pressed }) => [s.chip, boucle && s.chipActive, pressed && s.btnPressed]}
          onPress={() => setBoucle((v) => !v)}
        >
          <Ionicons name={boucle ? 'refresh-circle' : 'refresh-circle-outline'} size={13} color={boucle ? arcadeLabelColor(theme) : theme.textMuted} />
          <Text style={[s.chipText, boucle && s.chipTextActive]}>{t('routing.loop')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.chip, !includeCaptures && s.chipActive, pressed && s.btnPressed]}
          onPress={() => setIncludeCaptures((v) => !v)}
        >
          <Text style={[s.chipText, !includeCaptures && s.chipTextActive]}>{t('routing.filterUncaptured')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.chip, flashableOnly && s.chipActive, pressed && s.btnPressed]}
          onPress={() => setFlashableOnly((v) => !v)}
        >
          <Text style={[s.chipText, flashableOnly && s.chipTextActive]}>{t('routing.filterFlashable')}</Text>
        </Pressable>
      </View>

      <View style={s.stepper}>
        <Pressable style={({ pressed }) => [s.stepBtn, pressed && s.btnPressed]} onPress={decrement}>
          <ShadowText shadowColor={theme.titleShadow} style={s.stepBtnText}>−</ShadowText>
        </Pressable>
        <Text style={[s.stepValue, { color: boucle || detourMin > 0 ? theme.text : theme.accent }]}>
          {boucle ? fmtMin(durationMin) : (detourMin === 0 ? t('routing.detourDirect') : fmtMin(detourMin))}
        </Text>
        <Pressable style={({ pressed }) => [s.stepBtn, pressed && s.btnPressed]} onPress={increment}>
          <ShadowText shadowColor={theme.titleShadow} style={s.stepBtnText}>+</ShadowText>
        </Pressable>
      </View>

      <ComputeButton
        route={route} canCompute={canCompute} loading={loading}
        onCompute={onCompute} onCancel={onCancel} onStart={onStart}
        alignStart theme={theme} s={s}
      />
    </View>
  )
}

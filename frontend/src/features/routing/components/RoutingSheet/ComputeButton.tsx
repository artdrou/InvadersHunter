import { Pressable, Text, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { ThemeTokens } from '@/constants/theme'
import type { RouteResult } from '../../types'
import type { RoutingStyles } from './styles'
import { arcadeButton, arcadeButtonLabel, arcadeLabelColor } from '@/constants/arcade-button'

type Props = {
  route: RouteResult | null
  canCompute: boolean
  loading: boolean
  onCompute: () => void
  onCancel: () => void
  /** Left-align inside the expanded options panel (vs. filling the toggle row). */
  alignStart?: boolean
  theme: ThemeTokens
  s: RoutingStyles
}

/**
 * The routing action button: "Cancel" (danger) once a route exists, otherwise
 * "Start" which computes it (disabled until endpoints are set). Rendered both in
 * the collapsed toggle row and the expanded options panel.
 */
export function ComputeButton({ route, canCompute, loading, onCompute, onCancel, alignStart, theme, s }: Props) {
  const { t } = useTranslation()
  const align = alignStart ? { alignSelf: 'flex-start' as const } : null

  if (route) {
    return (
      <Pressable
        style={({ pressed }) => [s.actionBtn, arcadeButton(theme, 'danger'), align, pressed && s.btnPressed]}
        onPress={onCancel}
      >
        <Ionicons name="close" size={13} color={theme.danger} />
        <Text style={[s.actionBtnText, arcadeButtonLabel(theme, 'danger')]}>{t('common.cancel')}</Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      style={({ pressed }) => [s.actionBtn, canCompute ? arcadeButton(theme) : { backgroundColor: theme.bgElement }, align, canCompute && pressed && s.btnPressed]}
      onPress={onCompute}
      disabled={!canCompute}
    >
      {loading
        ? <ActivityIndicator size="small" color={canCompute ? arcadeLabelColor(theme) : theme.textMuted} />
        : <Ionicons name="flag" size={13} color={canCompute ? arcadeLabelColor(theme) : theme.textMuted} />
      }
      <Text style={[s.actionBtnText, canCompute ? arcadeButtonLabel(theme) : { color: theme.textMuted }]}>
        {t('routing.start')}
      </Text>
    </Pressable>
  )
}

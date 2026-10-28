import { View, Pressable, Text, ActivityIndicator } from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
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
  /** Hunt view: shown next to "Cancel" once a route exists. */
  onStart?: () => void
  /** Left-align inside the expanded options panel (vs. filling the toggle row). */
  alignStart?: boolean
  theme: ThemeTokens
  s: RoutingStyles
}

/**
 * The routing action buttons: "Cancel" (danger) + "Start" (hunt view) once a route
 * exists, otherwise "Route" which computes it (disabled until endpoints are set).
 * Rendered both in the collapsed toggle row and the expanded options panel.
 */
export function ComputeButton({ route, canCompute, loading, onCompute, onCancel, onStart, alignStart, theme, s }: Props) {
  const { t } = useTranslation()
  const align = alignStart ? { alignSelf: 'flex-start' as const } : null

  if (route) {
    return (
      <View style={[s.actionRow, align]}>
        <Pressable
          style={({ pressed }) => [s.actionBtn, arcadeButton(theme, 'danger'), pressed && s.btnPressed]}
          onPress={onCancel}
        >
          <Ionicons name="close" size={13} color={theme.danger} />
          <Text style={[s.actionBtnText, arcadeButtonLabel(theme, 'danger')]}>{t('common.cancel')}</Text>
        </Pressable>
        {onStart && (
          <Pressable
            style={({ pressed }) => [s.actionBtn, arcadeButton(theme), pressed && s.btnPressed]}
            onPress={onStart}
          >
            <MaterialCommunityIcons name="walk" size={13} color={arcadeLabelColor(theme)} />
            <Text style={[s.actionBtnText, arcadeButtonLabel(theme)]}>{t('hunt.start')}</Text>
          </Pressable>
        )}
      </View>
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
        : <Ionicons name="map" size={13} color={canCompute ? arcadeLabelColor(theme) : theme.textMuted} />
      }
      <Text style={[s.actionBtnText, canCompute ? arcadeButtonLabel(theme) : { color: theme.textMuted }]}>
        {t('routing.compute')}
      </Text>
    </Pressable>
  )
}

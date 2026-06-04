import { Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PixelButton } from '@/components/ui/pixel-button'
import type { ThemeTokens } from '@/constants/theme'

const SIZE = 54

type Props = {
  onPress: () => void
  active: boolean
  theme: ThemeTokens
}

/**
 * Isolated routing button — position is set by the parent so it can be moved without touching this file.
 */
export function RoutingFAB({ onPress, active, theme }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <PixelButton
        size={SIZE}
        fill={theme.bgElement}
        stroke={active ? theme.accent : theme.border}
      />
      <Ionicons
        name="navigate-outline"
        size={26}
        color={active ? theme.accent : theme.textMuted}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
})

import { Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ThemeTokens } from '@/constants/theme'

type Props = {
  onPress: () => void
  active: boolean
  theme: ThemeTokens
}

/**
 * Isolated FAB — position is set by the parent so it can be moved without touching this file.
 */
export function RoutingFAB({ onPress, active, theme }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: active ? theme.accent : theme.bgElement,
          borderColor: active ? theme.accent : theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={active ? 'navigate' : 'navigate-outline'}
        size={22}
        color={active ? theme.bg : theme.accent}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  pressed: { opacity: 0.7 },
})

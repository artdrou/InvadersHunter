import { Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PixelButton } from '@/components/ui/PixelButton'
import { ShadowIcon } from '@/components/ShadowIcon'
import { arcadePixelButton } from '@/constants/arcade-button'
import type { ThemeTokens } from '@/constants/theme'

const SIZE = 54

type Props = {
  onPress: () => void
  active: boolean
  theme: ThemeTokens
}

export function RoutingFAB({ onPress, active, theme }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <PixelButton
        size={SIZE}
        {...arcadePixelButton(theme, active).button}
      />
      <ShadowIcon
        name="navigate-outline"
        size={26}
        color={arcadePixelButton(theme, active).icon}
        shadowColor={arcadePixelButton(theme, active).iconShadow}
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

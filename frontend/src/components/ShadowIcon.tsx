/**
 * Ionicon with a sharp arcade offset shadow: a copy drawn behind, shifted down-right,
 * in the shadow colour (same trick as ShadowText).
 */
import { View, StyleSheet, type ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size: number;
  color: ColorValue;
  shadowColor: ColorValue;
  /** Offset in px (right and down). */
  offset?: number;
};

export function ShadowIcon({ name, size, color, shadowColor, offset = 2 }: Props) {
  return (
    <View style={{ width: size + offset, height: size + offset }}>
      <Ionicons
        name={name}
        size={size}
        color={shadowColor}
        style={[styles.copy, { top: offset, left: offset }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { position: 'absolute' },
});

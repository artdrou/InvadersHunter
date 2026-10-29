/**
 * Icon (Ionicons, or MaterialCommunityIcons with `family="mci"`) with a sharp arcade offset
 * shadow: a copy drawn behind, shifted down-right, in the shadow colour (same trick as ShadowText).
 */
import { View, StyleSheet, type ColorValue } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type Props = (
  | { family?: 'ion'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { family: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }
) & {
  size: number;
  color: ColorValue;
  shadowColor: ColorValue;
  /** Offset in px (right and down). */
  offset?: number;
};

export function ShadowIcon({ family, name, size, color, shadowColor, offset = 2 }: Props) {
  // Both families take the same props; the name was checked against its family above
  const Icon = (family === 'mci' ? MaterialCommunityIcons : Ionicons) as typeof Ionicons;
  const iconName = name as React.ComponentProps<typeof Ionicons>['name'];
  return (
    <View style={{ width: size + offset, height: size + offset }}>
      <Icon
        name={iconName}
        size={size}
        color={shadowColor}
        style={[styles.copy, { top: offset, left: offset }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Icon name={iconName} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { position: 'absolute' },
});

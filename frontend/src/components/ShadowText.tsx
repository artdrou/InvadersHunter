/**
 * Text with a sharp arcade offset shadow: a copy of the text drawn behind, shifted
 * down-right, in the shadow colour. RN's textShadow can't do it (Android drops the
 * shadow when its blur radius is 0, and any blur softens the pixel font).
 */
import { View, Text, StyleSheet, type TextProps, type ColorValue } from 'react-native';

type Props = TextProps & {
  shadowColor: ColorValue;
  /** Offset in px (right and down). */
  offset?: number;
};

export function ShadowText({ style, children, shadowColor, offset = 2, ...rest }: Props) {
  return (
    <View style={{ paddingRight: offset, paddingBottom: offset }}>
      <Text
        style={[style, styles.copy, { top: offset, left: offset, color: shadowColor }]}
        {...rest}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </Text>
      <Text style={style} {...rest}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { position: 'absolute' },
});

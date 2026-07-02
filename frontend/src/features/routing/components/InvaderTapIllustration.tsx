import { View, Image, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { Fonts, FontSize, BorderRadius, Spacing } from '@/constants/theme';

const markerUncaptured = require('../../../../assets/images/marker-50pts-flash-uncaptured.png');
const markerHighlight  = require('../../../../assets/images/marker-50pts-highlight.png');

export function InvaderTapIllustration() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      {/* Before: red uncaptured marker */}
      <View style={styles.side}>
        <Image source={markerUncaptured} style={styles.marker} resizeMode="contain" />
        <Text style={[styles.caption, { color: theme.textMuted }]}>Uncaptured</Text>
      </View>

      {/* Tap gesture */}
      <View style={styles.arrow}>
        <MaterialCommunityIcons name="gesture-tap" size={32} color={theme.accent} />
      </View>

      {/* After: highlighted/selected golden marker */}
      <View style={styles.side}>
        <Image source={markerHighlight} style={styles.marker} resizeMode="contain" />
        <Text style={[styles.caption, { color: theme.accent }]}>Stop added</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  side: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  marker: {
    width: 44,
    height: 60,
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  arrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

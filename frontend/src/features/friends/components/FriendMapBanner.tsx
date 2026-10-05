import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { useFriendsStore } from '../store';
import { FriendMarkerColor } from '../constants';

/**
 * Shown at the top of the map while it displays a friend's flashes: whose map
 * it is, a swap between "their map" and "shared", a close (back to my map),
 * and the 4-color legend on the shared map.
 */
export function FriendMapBanner() {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  const view = useFriendsStore((s) => s.mapView);
  const setMapView = useFriendsStore((s) => s.setMapView);
  if (!view) return null;

  const compare = view.mode === 'compare';
  const legend = [
    { color: FriendMarkerColor.both, label: t('social.legendBoth') },
    { color: FriendMarkerColor.mine, label: t('social.legendMine') },
    { color: FriendMarkerColor.friend, label: t('social.legendFriend', { username: view.username }) },
    { color: FriendMarkerColor.neither, label: t('social.legendNeither') },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={compare ? 'people' : 'person'} size={16} color={theme.accent} />
        <Text style={styles.title} numberOfLines={1}>
          {compare ? t('social.sharedWith', { username: view.username }) : t('social.mapOf', { username: view.username })}
        </Text>
        <Pressable
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => setMapView({ ...view, mode: compare ? 'friend' : 'compare' })}
        >
          <Ionicons name="swap-horizontal" size={18} color={theme.text} />
        </Pressable>
        <Pressable
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => setMapView(null)}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>
      </View>
      {compare ? (
        <View style={styles.legend}>
          {legend.map((l) => (
            <View key={l.color} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: l.color }]} />
              <Text style={styles.legendText} numberOfLines={1}>{l.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    card: {
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      gap: Spacing.one,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    title: { flex: 1, color: t.text, fontFamily: font, fontSize: sz(FontSize.sm) },
    iconBtn: { padding: 2 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    swatch: { width: 10, height: 10 },
    legendText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xxs },
    pressed: { opacity: 0.6 },
  });
}

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';

type Props = {
  count: number;
  /** Colour the bubble red when there are unseen comments. */
  hasNew?: boolean;
};

/**
 * Small count bubble pinned to the top-right of a comment icon. Renders nothing
 * when there are no comments. Accent by default, danger (red) when there's new
 * activity the user hasn't seen.
 */
export function CommentCountBadge({ count, hasNew }: Props) {
  const { theme } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.badge, { backgroundColor: hasNew ? theme.danger : theme.accent, borderColor: theme.bgElement }]}
    >
      <Text style={[styles.text, { color: theme.bg }]} numberOfLines={1}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});

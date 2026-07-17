import { useEffect, useMemo, useRef } from 'react';
import {
  View, Pressable, StyleSheet, ScrollView, Image,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { BorderRadius, Spacing } from '@/constants/theme';
import { hapticTap } from '@/features/settings';
import { SHAPE_IDS } from '../shapes';
import { renderMarkerBase64 } from '../generate-markers';
import type { TierPts } from '../types';

// Horizontal sibling of the settings screen's vertical ShapeCarousel: same six
// silhouettes, same rasterizer, but laid out along the form's width — a vertical
// picker inside an already-tall create form would fight the scroll.
const ITEM = 56;
const THUMB = 48;
const THUMB_RENDER = 96;

type Props = {
  value: TierPts;
  onChange: (shapeId: TierPts) => void;
  /** Palette the previews are drawn in — the colours the marker will really use. */
  iconHex: string;
  glowHex: string;
};

// Rasterizing happens synchronously during render. renderMarkerBase64 throws if
// a Skia allocation/parse/encode fails (memory pressure), and a throw here would
// take the whole form down via the error boundary — fall back to no image.
function safeMarkerUri(shapeId: TierPts, iconHex: string, glowHex: string): string | undefined {
  try {
    return `data:image/png;base64,${renderMarkerBase64(shapeId, iconHex, glowHex, THUMB_RENDER)}`;
  } catch {
    return undefined;
  }
}

/** Picks which of the six marker silhouettes a personal invader is drawn with. */
export function IconCarousel({ value, onChange, iconHex, glowHex }: Props) {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const firstRun = useRef(true);
  const index = Math.max(0, SHAPE_IDS.indexOf(value));

  const thumbnails = useMemo(
    () => Object.fromEntries(SHAPE_IDS.map((sid) => [sid, safeMarkerUri(sid, iconHex, glowHex)])),
    [iconHex, glowHex],
  ) as Record<TierPts, string | undefined>;

  // Keep the scroll offset aligned with the selection: instant on mount (so an
  // edit opens on the stored shape), animated afterwards.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: index * ITEM, animated: !firstRun.current });
    firstRun.current = false;
  }, [index]);

  // Wired to both momentum-end and drag-end: a fling settles via momentum, but a
  // slow drag released at rest only fires onScrollEndDrag — without both, the
  // visible shape could diverge from the stored one.
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(SHAPE_IDS.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / ITEM)));
    if (SHAPE_IDS[i] !== value) { hapticTap(); onChange(SHAPE_IDS[i]); }
  };

  return (
    <View style={styles.viewport}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM}
        disableIntervalMomentum
        decelerationRate="fast"
        contentOffset={{ x: index * ITEM, y: 0 }}
        onScrollEndDrag={onScrollEnd}
        onMomentumScrollEnd={onScrollEnd}
      >
        {SHAPE_IDS.map((sid) => (
          <Pressable
            key={sid}
            style={styles.item}
            onPress={() => { if (sid !== value) { hapticTap(); onChange(sid); } }}
          >
            <View style={[
              styles.thumbFrame,
              { borderColor: sid === value ? theme.accent : 'transparent' },
            ]}>
              <Image source={{ uri: thumbnails[sid] }} style={styles.thumb} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    height: ITEM,
  },
  item: {
    width: ITEM,
    height: ITEM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFrame: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.half,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
});

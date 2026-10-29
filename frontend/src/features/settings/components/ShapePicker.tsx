/**
 * Silhouette picker shared by the profile icon editor and the marker customization:
 * a big preview between pixel arrows (previous / next, wrapping around at both ends),
 * then every shape of the pool in a grid.
 */
import { ReactNode, useState } from 'react';
import { View, Pressable, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, BorderRadius, Spacing } from '@/constants/theme';
import { PixelArrow } from '@/components/ui/PixelArrow';
import { ALL_SHAPE_IDS } from '@/features/marker-customization/shapes';
import type { ShapeId } from '@/features/marker-customization/types';
import { tap as hapticTap } from '../haptics';

const ARROW_PIXEL = 5;
// Grid cells are sized from the measured width; the silhouette fills most of each
const COLUMNS = 7;
const CELL_GAP = Spacing.two;
const THUMB_FILL = 0.8;

type Props = {
  /** null: nothing picked (a marker state left on its points' shape); arrows start from the first shape. */
  selected: ShapeId | null;
  onSelect: (shape: ShapeId) => void;
  /** Image URI of a shape's thumbnail (drawn by the screen, in its colors). */
  thumbnail: (shape: ShapeId) => string | undefined;
  /** What sits between the arrows (the big preview). */
  preview: ReactNode;
  /** Optional content between the preview and the grid (e.g. a section label). */
  between?: ReactNode;
};

export function ShapePicker({ selected, onSelect, thumbnail, preview, between }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [gridWidth, setGridWidth] = useState(0);
  const cell = gridWidth > 0 ? Math.floor((gridWidth - CELL_GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  function step(delta: number) {
    hapticTap();
    const i = selected === null ? -1 : ALL_SHAPE_IDS.indexOf(selected);
    if (i < 0) { onSelect(ALL_SHAPE_IDS[delta > 0 ? 0 : ALL_SHAPE_IDS.length - 1]); return; }
    onSelect(ALL_SHAPE_IDS[(i + delta + ALL_SHAPE_IDS.length) % ALL_SHAPE_IDS.length]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.previewRow}>
        <Pressable onPress={() => step(-1)} hitSlop={12} style={({ pressed }) => [styles.arrowBtn, pressed && styles.pressed]}>
          <PixelArrow direction="left" color={theme.accent} shadowColor={theme.titleShadow} pixel={ARROW_PIXEL} />
        </Pressable>
        {preview}
        <Pressable onPress={() => step(1)} hitSlop={12} style={({ pressed }) => [styles.arrowBtn, pressed && styles.pressed]}>
          <PixelArrow direction="right" color={theme.accent} shadowColor={theme.titleShadow} pixel={ARROW_PIXEL} />
        </Pressable>
      </View>

      {between}

      <View
        style={styles.grid}
        // A hidden parent reports 0: keep the last real width so the grid doesn't redraw
        onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w > 0) setGridWidth(w); }}
      >
        {cell > 0 && ALL_SHAPE_IDS.map((shape) => (
          <Pressable
            key={shape}
            onPress={() => { hapticTap(); onSelect(shape); }}
            style={({ pressed }) => [
              styles.cell, { width: cell, height: cell },
              shape === selected && { borderColor: theme.accent },
              pressed && styles.pressed,
            ]}
          >
            <Image source={{ uri: thumbnail(shape) }} style={{ width: cell * THUMB_FILL, height: cell * THUMB_FILL }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    wrap: { gap: Spacing.three },
    previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.two },
    arrowBtn: { padding: Spacing.two },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
    cell: {
      alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: t.border, backgroundColor: t.bgElement,
    },
    pressed: { opacity: 0.6 },
  });
}

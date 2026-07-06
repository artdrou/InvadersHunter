import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const GRID = 31;
const CENTER = 15;

type Kind = 1 | 2;
type Cell = { r: number; c: number; kind: Kind };

function rasterize(): { circle: Cell[]; ring: Cell[] } {
  const circle: Cell[] = [];
  const ring: Cell[] = [];

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (Math.sqrt((r - CENTER) ** 2 + (c - CENTER) ** 2) <= CENTER - 0.5) {
        circle.push({ r, c, kind: 1 });
      }
    }
  }

  const outerR = 8;
  const ringMask: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const d = Math.sqrt((r - CENTER) ** 2 + (c - CENTER) ** 2);
      if (d >= outerR - 0.7 && d <= outerR + 0.7) ringMask[r][c] = true;
    }
  }
  for (let r = 3; r <= CENTER - outerR - 1; r++) ringMask[r][CENTER] = true;
  for (let r = CENTER + outerR + 1; r <= GRID - 4; r++) ringMask[r][CENTER] = true;
  for (let c = 3; c <= CENTER - outerR - 1; c++) ringMask[CENTER][c] = true;
  for (let c = CENTER + outerR + 1; c <= GRID - 4; c++) ringMask[CENTER][c] = true;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (Math.sqrt((r - CENTER) ** 2 + (c - CENTER) ** 2) <= 1.5) ringMask[r][c] = true;
    }
  }
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (ringMask[r][c]) ring.push({ r, c, kind: 2 });
    }
  }

  return { circle, ring };
}

const { circle: CIRCLE_CELLS, ring: RING_CELLS } = rasterize();

type Props = {
  locked: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: number;
  colorCircle: string;
  colorRing: string;
  colorCircleLocked?: string;
  colorRingLocked: string;
};

export function AimIcon({
  locked,
  onPress,
  onLongPress,
  size = 44,
  colorCircle,
  colorRing,
  colorCircleLocked,
  colorRingLocked,
}: Props) {
  const scale = size / GRID;
  const pixelSize = scale + 0.5;
  const ringColor = locked ? colorRingLocked : colorRing;
  const circleColor = locked ? (colorCircleLocked ?? colorCircle) : colorCircle;

  const ringStyle = useMemo(() => ({ color: ringColor }), [ringColor]);
  const circleStyle = useMemo(() => ({ color: circleColor }), [circleColor]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[styles.container, { width: size, height: size }]}
      hitSlop={8}
    >
      {CIRCLE_CELLS.map((cell, i) => (
        <View
          key={`c${i}`}
          style={{
            position: "absolute",
            left: cell.c * scale,
            top: cell.r * scale,
            width: pixelSize,
            height: pixelSize,
            backgroundColor: circleStyle.color,
          }}
        />
      ))}
      {RING_CELLS.map((cell, i) => (
        <View
          key={`r${i}`}
          style={{
            position: "absolute",
            left: cell.c * scale,
            top: cell.r * scale,
            width: pixelSize,
            height: pixelSize,
            backgroundColor: ringStyle.color,
          }}
        />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative" },
});

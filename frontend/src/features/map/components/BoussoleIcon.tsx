import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useHeadingStore } from "../store";

const GRID = 31;
const CENTER = 15;
const FRAMES = 48;

type Kind = 1 | 2 | 3 | 4 | 5;
type Cell = { r: number; c: number; kind: Kind };
type Pt = { r: number; c: number };

function rasterizeFrame(angleDeg: number): Cell[] {
  const canvas: number[][] = Array.from({ length: GRID }, () => Array(GRID).fill(0));
  const set = (r: number, c: number, v: number) => {
    if (r >= 0 && r < GRID && c >= 0 && c < GRID && canvas[r][c] < v) canvas[r][c] = v;
  };

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const dr = r - CENTER;
      const dc = c - CENTER;
      if (Math.sqrt(dr * dr + dc * dc) <= CENTER - 0.5) set(r, c, 1);
    }
  }

  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const tipN: Pt  = { r: CENTER + (CENTER - 2) * Math.sin(rad),         c: CENTER + (CENTER - 2) * Math.cos(rad) };
  const tipS: Pt  = { r: CENTER - (CENTER - 2) * Math.sin(rad),         c: CENTER - (CENTER - 2) * Math.cos(rad) };
  const wingR: Pt = { r: CENTER + 6 * Math.sin(rad + Math.PI / 2),      c: CENTER + 6 * Math.cos(rad + Math.PI / 2) };
  const wingL: Pt = { r: CENTER + 6 * Math.sin(rad - Math.PI / 2),      c: CENTER + 6 * Math.cos(rad - Math.PI / 2) };

  const sign = (p: Pt, q: Pt, s: Pt) => (p.r - s.r) * (q.c - s.c) - (q.r - s.r) * (p.c - s.c);
  const inTri = (pr: number, pc: number, a: Pt, b: Pt, c2: Pt) => {
    const p = { r: pr, c: pc };
    const d1 = sign(p, a, b);
    const d2 = sign(p, b, c2);
    const d3 = sign(p, c2, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const dr = r - CENTER;
      const dc = c - CENTER;
      if (Math.sqrt(dr * dr + dc * dc) > CENTER - 0.5) continue;
      if (inTri(r, c, tipN, wingR, wingL)) set(r, c, 3);
      if (inTri(r, c, tipS, wingR, wingL)) set(r, c, 2);
    }
  }

  for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    set(CENTER + dr, CENTER + dc, 4);
  }
  set(CENTER, CENTER, 5);

  const cells: Cell[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = canvas[r][c];
      if (v !== 0) cells.push({ r, c, kind: v as Kind });
    }
  }
  return cells;
}

// 48-frame sprite sheet, computed once at module load. Geometry only — colors
// are applied at render time so the icon can be re-themed without recomputing.
const SPRITE_SHEET: Cell[][] = Array.from({ length: FRAMES }, (_, i) =>
  rasterizeFrame((i * 360) / FRAMES)
);

type Props = {
  onPress?: () => void;
  size?: number;
  colorCircle: string;
  colorNorth: string;
  colorSouth: string;
};

export function BoussoleIcon({ onPress, size = 44, colorCircle, colorNorth, colorSouth }: Props) {
  const heading = useHeadingStore((s) => s.heading);
  const scale = size / GRID;

  // Map bearing rotates the world clockwise; the needle must spin the opposite
  // way so the red tip keeps pointing to true north on screen.
  const norm = (((-heading) % 360) + 360) % 360;
  const frameIndex = Math.round(norm / (360 / FRAMES)) % FRAMES;
  const cells = SPRITE_SHEET[frameIndex];

  const colorByKind = useMemo<Record<Kind, string>>(() => ({
    1: colorCircle,
    2: colorSouth,
    3: colorNorth,
    4: colorCircle,
    5: colorSouth,
  }), [colorCircle, colorNorth, colorSouth]);

  const pixelSize = scale + 0.5; // overlap to avoid hairline gaps

  return (
    <Pressable onPress={onPress} style={[styles.container, { width: size, height: size }]} hitSlop={8}>
      {cells.map((cell, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: cell.c * scale,
            top: cell.r * scale,
            width: pixelSize,
            height: pixelSize,
            backgroundColor: colorByKind[cell.kind],
          }}
        />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative" },
});

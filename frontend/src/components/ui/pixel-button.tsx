import { View, StyleSheet, PixelRatio } from "react-native";

// 12x12 pixel grid from dev/markers/src/pixel-button.jsx
//   O = outline (stroke)
//   F = fill
//   . = transparent
const PIXEL_GRID: string[] = [
  "...OOOOOO...",
  "..OFFFFFFO..",
  ".OFFFFFFFFO.",
  "OFFFFFFFFFFO",
  "OFFFFFFFFFFO",
  "OFFFFFFFFFFO",
  "OFFFFFFFFFFO",
  "OFFFFFFFFFFO",
  "OFFFFFFFFFFO",
  ".OFFFFFFFFO.",
  "..OFFFFFFO..",
  "...OOOOOO...",
];

const GRID = 12;

type Props = {
  size: number;
  fill: string;
  stroke: string;
};

type Run = { x: number; y: number; w: number; color: string };

function buildRuns(fill: string, stroke: string): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < GRID; y++) {
    const row = PIXEL_GRID[y];
    let runStart = -1;
    let runChar = ".";
    for (let x = 0; x <= GRID; x++) {
      const c = x < GRID ? row[x] : ".";
      if (c !== runChar) {
        if (runChar !== "." && runStart >= 0) {
          runs.push({ x: runStart, y, w: x - runStart, color: runChar === "O" ? stroke : fill });
        }
        runStart = x;
        runChar = c;
      }
    }
  }
  return runs;
}

// Render each pixel-row run as one absolutely-positioned View, overlapping
// neighbours by 1 device pixel to mask the sub-pixel rounding gaps that
// appear at fractional device-pixel ratios (e.g. 2.625). The parent clips
// the overflow so the overlap doesn't extend the visible bounds.
export function PixelButton({ size, fill, stroke }: Props) {
  const cell = size / GRID;
  const overlap = 1 / PixelRatio.get();
  const runs = buildRuns(fill, stroke);

  return (
    <View style={[StyleSheet.absoluteFill, { width: size, height: size, overflow: "hidden" }]}>
      {runs.map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: r.x * cell,
            top: r.y * cell,
            width: r.w * cell + overlap,
            height: cell + overlap,
            backgroundColor: r.color,
          }}
        />
      ))}
    </View>
  );
}

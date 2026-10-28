import { useMemo } from "react";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";

// Pixel-art triangle, one entry per row = how many pixels wide that row is
const ROWS = [1, 2, 3, 4, 3, 2, 1];
const WIDTH = Math.max(...ROWS);

// The staircase outline as one closed path (right-pointing), in pixel units
function outline(): [number, number][] {
  const right: [number, number][] = ROWS.flatMap((w, y) => [[w, y], [w, y + 1]] as [number, number][]);
  return [[0, 0], ...right, [0, ROWS.length]];
}

type Props = {
  direction: "left" | "right";
  color: string;
  /** Arcade offset shadow drawn behind (down-right), e.g. theme.titleShadow. */
  shadowColor?: string;
  /** Size of one pixel; the arrow is 4 pixels wide and 7 tall. */
  pixel?: number;
  /** Shadow offset in pt. */
  shadowOffset?: number;
};

/**
 * Arcade-style arrow: a pixel staircase drawn as a single filled shape (stacked
 * Views showed hairline seams between rows), with an optional offset shadow.
 */
export function PixelArrow({ direction, color, shadowColor, pixel = 4, shadowOffset = 3 }: Props) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    outline().forEach(([x, y], i) => {
      const px = (direction === "right" ? x : WIDTH - x) * pixel;
      if (i === 0) p.moveTo(px, y * pixel);
      else p.lineTo(px, y * pixel);
    });
    p.close();
    return p;
  }, [direction, pixel]);
  const shadow = useMemo(() => {
    const p = path.copy();
    p.offset(shadowOffset, shadowOffset);
    return p;
  }, [path, shadowOffset]);

  const pad = shadowColor ? shadowOffset : 0;
  return (
    <Canvas style={{ width: WIDTH * pixel + pad, height: ROWS.length * pixel + pad }}>
      {shadowColor && <Path path={shadow} color={shadowColor} />}
      <Path path={path} color={color} />
    </Canvas>
  );
}

import { Brand } from "@/constants/theme";

type Invader = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  isCaptured?: boolean;
  points?: number;
};

export function createInvaderMarker(invader: Invader) {
  const el = document.createElement("div");

  const size = invader.points ? Math.min(24, 10 * Math.log10(invader.points)) : 12;

  el.style.width = `${size * 9 / 5}px`;
  el.style.height = `${size}px`;
  el.style.display = "grid";
  el.style.gridTemplateColumns = "repeat(9, 1fr)";
  el.style.gridTemplateRows = "repeat(5, 1fr)";
  el.style.gap = "1px";
  el.style.cursor = "pointer";

  el.style.filter = invader.isCaptured
    ? `drop-shadow(0 0 8px ${Brand.capturedGlow})`
    : `drop-shadow(0 0 4px ${Brand.uncapturedGlow})`;

  const backgroundColor = invader.isCaptured ? Brand.cyan : Brand.pink;
  const outlineColor = invader.isCaptured ? Brand.capturedOutline : Brand.uncapturedOutline;

  const pixels = [
    0, 0, 0, 1, 0, 1, 0, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 0, 1, 0, 1, 0, 0,
    0, 1, 1, 1, 1, 1, 1, 1, 0,
    1, 1, 0, 1, 0, 1, 0, 1, 1,
  ];

  pixels.forEach((value) => {
    const pixel = document.createElement("div");
    pixel.style.backgroundColor = value ? backgroundColor : "transparent";
    pixel.style.outline = value ? `0.01px solid ${outlineColor}` : "none";
    el.appendChild(pixel);
  });

  return el;
}

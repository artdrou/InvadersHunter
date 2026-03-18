
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

    // dynamic size
    const size = invader.points ? Math.min(24, 10 * Math.log10(invader.points)) : 12;

    el.style.width = `${size*9/5}px`;
    el.style.height = `${size}px`;
    el.style.display = "grid";
    el.style.gridTemplateColumns = "repeat(9, 1fr)";
    el.style.gridTemplateRows = "repeat(5, 1fr)";
    el.style.gap = "1px";
    el.style.cursor = "pointer";

    el.style.filter = invader.isCaptured
    ? "drop-shadow(0 0 8px rgba(0, 96, 240, 0.9))"
    : "drop-shadow(0 0 4px rgba(171, 5, 19, 0.9))";

    const backgroundColor = invader.isCaptured ? "#1cffb7": "#ff0062" ;
    const outlineColor = invader.isCaptured ? "#00b7e0": "#79032e" ;

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
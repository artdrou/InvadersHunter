import { useState, useEffect, useRef, useMemo } from "react";

const GRID = 31;
const CENTER = 15;
const FRAMES = 48; // 7.5° steps

function rasterizeFrame(angleDeg) {
  const canvas = Array.from({ length: GRID }, () => Array(GRID).fill(0));

  const set = (r, c, v) => {
    if (r >= 0 && r < GRID && c >= 0 && c < GRID)
      if (canvas[r][c] < v) canvas[r][c] = v;
  };

  // Blue circle background
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const dr = r - CENTER, dc = c - CENTER;
      if (Math.sqrt(dr * dr + dc * dc) <= CENTER - 0.5) set(r, c, 1);
    }
  }

  // Diamond tips & wings
  const rad = (angleDeg - 90) * Math.PI / 180;
  const tipN  = { r: CENTER + (CENTER - 2) * Math.sin(rad),    c: CENTER + (CENTER - 2) * Math.cos(rad) };
  const tipS  = { r: CENTER - (CENTER - 2) * Math.sin(rad),    c: CENTER - (CENTER - 2) * Math.cos(rad) };
  const wingR = { r: CENTER + 6 * Math.sin(rad + Math.PI / 2), c: CENTER + 6 * Math.cos(rad + Math.PI / 2) };
  const wingL = { r: CENTER + 6 * Math.sin(rad - Math.PI / 2), c: CENTER + 6 * Math.cos(rad - Math.PI / 2) };

  const inTriangle = (pr, pc, a, b, c2) => {
    const sign = (p, q, s) => (p.r - s.r) * (q.c - s.c) - (q.r - s.r) * (p.c - s.c);
    const p = { r: pr, c: pc };
    const d1 = sign(p, a, b), d2 = sign(p, b, c2), d3 = sign(p, c2, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const dr = r - CENTER, dc = c - CENTER;
      if (Math.sqrt(dr * dr + dc * dc) > CENTER - 0.5) continue;
      if (inTriangle(r, c, tipN, wingR, wingL)) set(r, c, 3); // north red
      if (inTriangle(r, c, tipS, wingR, wingL)) set(r, c, 2); // south white
    }
  }

  // Center dot
  for (const [dr, dc] of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]])
    set(CENTER + dr, CENTER + dc, 4);
  set(CENTER, CENTER, 5);

  return canvas;
}

const COLORS = {
  0: null,
  1: "#1a56c4",   // blue circle
  2: "#f0f4f8",   // south white
  3: "#e63946",   // north red
  4: "#0a1a3a",   // center dot dark
  5: "#ffffff",   // center dot bright
};

function PixelFrame({ grid, scale }) {
  return (
    <svg width={GRID*scale} height={GRID*scale} viewBox={`0 0 ${GRID*scale} ${GRID*scale}`}
      style={{ imageRendering: "pixelated", display: "block" }}>
      {grid.map((row, r) => row.map((val, c) => {
        const color = COLORS[val];
        if (!color) return null;
        return <rect key={`${r}-${c}`} x={c*scale} y={r*scale} width={scale} height={scale} fill={color}/>;
      }))}
    </svg>
  );
}

export default function Boussole() {
  const spriteSheet = useMemo(() =>
    Array.from({ length: FRAMES }, (_, i) => rasterizeFrame(i * 360 / FRAMES))
  , []);

  const [heading, setHeading] = useState(37);
  const [resetting, setResetting] = useState(false);
  const [ripple, setRipple] = useState(false);
  const animRef = useRef(null);

  const frameIndex = Math.round(((heading % 360) + 360) % 360 / (360 / FRAMES)) % FRAMES;

  const handleClick = () => {
    if (resetting) return;
    setResetting(true);
    setRipple(true);
    setTimeout(() => setRipple(false), 700);
    const from = ((heading % 360) + 360) % 360;
    const shortest = from > 180 ? from - 360 : from;
    const startTime = performance.now();
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const animate = (now) => {
      const t = Math.min((now - startTime) / 600, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setHeading(shortest * (1 - ease));
      if (t < 1) animRef.current = requestAnimationFrame(animate);
      else { setHeading(0); setResetting(false); }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (resetting) return;
    const id = setInterval(() => setHeading(h => h + 0.25), 50);
    return () => clearInterval(id);
  }, [resetting]);

  const deg = Math.round(((heading % 360) + 360) % 360);
  const cardinal = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(deg/22.5)%16];

  return (
    <div style={{
      minHeight: "100vh", background: "#07080f",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 32, fontFamily: "'Courier New', monospace",
      padding: "20px 0 40px",
    }}>
      <div style={{ color: "#1a56c4", fontSize: 11, letterSpacing: 8 }}>BOUSSOLE</div>

      {/* Live compass */}
      <div style={{ position: "relative", cursor: "pointer" }} onClick={handleClick}>
        {ripple && (
          <div style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: "2px solid #1a56c4",
            animation: "rpl 0.7s ease-out forwards", pointerEvents: "none",
          }}/>
        )}
        <PixelFrame grid={spriteSheet[frameIndex]} scale={14}/>
      </div>

      {/* Heading */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ color: "#e63946", fontSize: 30, letterSpacing: 3, fontVariantNumeric: "tabular-nums" }}>
          {deg.toString().padStart(3, "0")}°
        </span>
        <span style={{ color: "#1a56c4", fontSize: 12, letterSpacing: 2, minWidth: 40 }}>{cardinal}</span>
      </div>

      <div style={{ color: "#1a3060", fontSize: 9, letterSpacing: 4 }}>TAP TO RESET NORTH</div>

      {/* Sprite sheet */}
      <div>
        <div style={{ color: "#1a3060", fontSize: 9, letterSpacing: 3, textAlign: "center", marginBottom: 8 }}>
          {FRAMES} FRAMES · {360/FRAMES}° / STEP
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(12, ${GRID*3}px)`,
          gap: 2, background: "#050810", padding: 6,
          border: "1px solid #0d1830",
        }}>
          {spriteSheet.map((frame, i) => (
            <div key={i}
              onClick={() => setHeading(i * 360 / FRAMES)}
              style={{
                outline: i === frameIndex ? "1px solid #e63946" : "1px solid #0a1228",
                opacity: i === frameIndex ? 1 : 0.4,
                cursor: "pointer",
              }}>
              <PixelFrame grid={frame} scale={3}/>
            </div>
          ))}
        </div>
        <div style={{ color: "#1a3060", fontSize: 8, letterSpacing: 2, textAlign: "center", marginTop: 6 }}>
          CLICK ANY FRAME TO JUMP
        </div>
      </div>

      <style>{`
        @keyframes rpl {
          from { transform: scale(1); opacity: 1; }
          to   { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

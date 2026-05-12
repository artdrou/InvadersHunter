import { useState, useRef, useMemo } from "react";

const GRID = 31;
const CENTER = 15;

const COLORS = {
  0: null,
  1: "#1a56c4",
  2: "#f0f4f8",
  4: "#e63946",
  5: "#0a1a3a",
  6: "#ffffff",
};

function drawIcon(locked) {
  const g = Array.from({ length: GRID }, () => Array(GRID).fill(0));
  const s = (r, c, v) => { if (r>=0&&r<GRID&&c>=0&&c<GRID) g[r][c]=v; };
  const col = locked ? 4 : 2;

  // Blue background circle
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (Math.sqrt((r-CENTER)**2+(c-CENTER)**2) <= CENTER-0.5)
        s(r, c, 1);

  // Outer ring — radius 8 (was 10)
  const outerR = 8;
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const d = Math.sqrt((r-CENTER)**2+(c-CENTER)**2);
      if (d >= outerR-0.7 && d <= outerR+0.7) s(r, c, col);
    }

  // Crosshair arms — only outside the ring
  for (let r = 3; r <= CENTER-outerR-1; r++) s(r, CENTER, col);
  for (let r = CENTER+outerR+1; r <= GRID-4; r++) s(r, CENTER, col);
  for (let c = 3; c <= CENTER-outerR-1; c++) s(CENTER, c, col);
  for (let c = CENTER+outerR+1; c <= GRID-4; c++) s(CENTER, c, col);

  // Center dot — radius 1.5
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (Math.sqrt((r-CENTER)**2+(c-CENTER)**2) <= 1.5)
        s(r, c, col);

  return g;
}

function drawLock() {
  const LW = 11, LH = 13;
  const g = Array.from({ length: LH }, () => Array(LW).fill(0));
  const s = (r, c, v) => { if (r>=0&&r<LH&&c>=0&&c<LW) g[r][c]=v; };
  s(0,3,5);s(0,4,5);s(0,5,5);s(0,6,5);s(0,7,5);
  s(1,2,5);s(1,8,5); for(let c=3;c<=7;c++) s(1,c,6);
  s(2,2,5);s(2,8,5); for(let c=3;c<=7;c++) s(2,c,6);
  s(3,2,5);s(3,8,5); for(let c=3;c<=7;c++) s(3,c,6);
  for(let c=0;c<=10;c++){s(4,c,5);s(12,c,5);}
  for(let r=5;r<=11;r++){s(r,0,5);s(r,10,5);}
  for(let r=5;r<=11;r++) for(let c=1;c<=9;c++) s(r,c,1);
  s(6,4,5);s(6,5,5);s(6,6,5);
  s(7,3,5);s(7,7,5);
  s(8,4,5);s(8,5,5);s(8,6,5);
  s(9,4,5);s(9,5,5);s(9,6,5);
  s(10,5,5);
  s(7,4,6);s(7,5,6);s(7,6,6);s(8,5,6);
  return g;
}

function PixelGrid({ grid, scale }) {
  const rows = grid.length, cols = grid[0].length;
  return (
    <svg width={cols*scale} height={rows*scale}
      viewBox={`0 0 ${cols*scale} ${rows*scale}`}
      style={{ imageRendering:"pixelated", display:"block" }}>
      {grid.map((row,r) => row.map((val,c) => {
        const color = COLORS[val];
        if (!color) return null;
        return <rect key={`${r}-${c}`} x={c*scale} y={r*scale} width={scale} height={scale} fill={color}/>;
      }))}
    </svg>
  );
}

export default function AimIcon() {
  const [locked, setLocked] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const longPressTimer = useRef(null);
  const progressTimer = useRef(null);
  const LONG_PRESS_MS = 600;

  const iconGrid  = useMemo(() => drawIcon(locked), [locked]);
  const iconGridD = useMemo(() => drawIcon(false), []);
  const iconGridL = useMemo(() => drawIcon(true), []);
  const lockGrid  = useMemo(() => drawLock(), []);

  const startPress = (e) => {
    e.preventDefault();
    if (locked) { setLocked(false); return; }
    setPressing(true);
    setProgress(0);
    const start = performance.now();
    progressTimer.current = setInterval(() => {
      setProgress(Math.min((performance.now()-start)/LONG_PRESS_MS, 1));
    }, 16);
    longPressTimer.current = setTimeout(() => {
      clearInterval(progressTimer.current);
      setLocked(true);
      setPressing(false);
      setProgress(0);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    clearTimeout(longPressTimer.current);
    clearInterval(progressTimer.current);
    setPressing(false);
    setProgress(0);
  };

  const SCALE = 14;
  const iconPx = GRID * SCALE;
  const svgSize = iconPx + 24;
  const ringR = iconPx / 2 + 6;

  return (
    <div style={{
      minHeight:"100vh", background:"#07080f",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      gap:32, fontFamily:"'Courier New', monospace",
      userSelect:"none", WebkitUserSelect:"none",
    }}>
      <div style={{color:"#1a56c4", fontSize:11, letterSpacing:6}}>AIM ICON</div>

      <div
        onMouseDown={startPress} onMouseUp={cancelPress}
        onMouseLeave={cancelPress} onTouchStart={startPress}
        onTouchEnd={cancelPress} onTouchCancel={cancelPress}
        style={{
          position:"relative", cursor: locked ? "pointer" : "crosshair",
          transform: pressing ? "scale(0.94)" : "scale(1)",
          transition:"transform 0.1s",
        }}
      >
        {pressing && progress > 0 && (
          <svg width={svgSize} height={svgSize}
            style={{position:"absolute", top:-12, left:-12, pointerEvents:"none"}}>
            <circle cx={svgSize/2} cy={svgSize/2} r={ringR}
              fill="none" stroke="#e63946" strokeWidth="3"
              strokeDasharray={`${progress*2*Math.PI*ringR} ${2*Math.PI*ringR}`}
              strokeLinecap="butt"
              transform={`rotate(-90 ${svgSize/2} ${svgSize/2})`}/>
          </svg>
        )}

        <PixelGrid grid={iconGrid} scale={SCALE}/>

        {locked && (
          <div style={{position:"absolute", bottom:-6, right:-6, background:"#07080f", padding:2}}>
            <PixelGrid grid={lockGrid} scale={4}/>
          </div>
        )}
      </div>

      <div style={{color: locked?"#e63946":pressing?"#1a56c4":"#1a3060", fontSize:10, letterSpacing:4, transition:"color 0.2s"}}>
        {locked ? "LOCKED" : pressing ? `${Math.round(progress*100)}%` : "LONG PRESS TO LOCK"}
      </div>
      <div style={{color: locked?"#1a3060":"transparent", fontSize:8, letterSpacing:3}}>TAP TO UNLOCK</div>

      <div style={{width:260, height:1, background:"#0d1830", margin:"4px 0"}}/>
      <div style={{color:"#1a3060", fontSize:9, letterSpacing:3, marginBottom:4}}>STATES</div>
      <div style={{display:"flex", gap:40, alignItems:"flex-end"}}>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
          <PixelGrid grid={iconGridD} scale={5}/>
          <div style={{color:"#1a3060", fontSize:8, letterSpacing:2}}>DEFAULT</div>
        </div>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
          <PixelGrid grid={iconGridL} scale={5}/>
          <div style={{color:"#e63946", fontSize:8, letterSpacing:2}}>LOCKED</div>
        </div>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
          <div style={{position:"relative", display:"inline-block"}}>
            <PixelGrid grid={iconGridL} scale={5}/>
            <div style={{position:"absolute", bottom:-3, right:-3, background:"#07080f", padding:1}}>
              <PixelGrid grid={lockGrid} scale={3}/>
            </div>
          </div>
          <div style={{color:"#e63946", fontSize:8, letterSpacing:2}}>+ BADGE</div>
        </div>
      </div>
    </div>
  );
}

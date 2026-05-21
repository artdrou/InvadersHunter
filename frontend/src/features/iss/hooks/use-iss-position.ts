import { useState, useEffect, useRef } from 'react';
import { ISS_API_URL, ISS_POLL_MS, ISS_LERP_TICK_MS } from '../constants';

type Coords = [number, number]; // [lon, lat]

export function useIssPosition(): Coords | null {
  const [position, setPosition] = useState<Coords | null>(null);

  // fromRef: position at the moment the latest API response arrived (lerp origin)
  const fromRef = useRef<Coords | null>(null);
  // toRef: latest API position (lerp destination)
  const toRef = useRef<Coords | null>(null);
  // when the current lerp started
  const lerpStartRef = useRef<number>(0);
  // mirrors current displayed position so next lerp starts from where we are, not from a stale origin
  const currentPosRef = useRef<Coords | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(ISS_API_URL);
        const data = await res.json();
        if (cancelled) return;
        const newPos: Coords = [data.longitude, data.latitude];

        if (!currentPosRef.current) {
          // First ever position — set directly, no lerp needed
          currentPosRef.current = newPos;
          fromRef.current = newPos;
          toRef.current = newPos;
          setPosition(newPos);
        } else {
          // Start a new lerp from wherever we currently are displayed
          fromRef.current = currentPosRef.current;
          toRef.current = newPos;
          lerpStartRef.current = Date.now();
        }
      } catch {
        // keep last known position on error
      }
    }

    poll();
    const pollId = setInterval(poll, ISS_POLL_MS);

    const animId = setInterval(() => {
      const from = fromRef.current;
      const to = toRef.current;
      if (!from || !to) return;

      const t = Math.min((Date.now() - lerpStartRef.current) / ISS_POLL_MS, 1);
      const pos: Coords = [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ];
      currentPosRef.current = pos;
      setPosition(pos);
    }, ISS_LERP_TICK_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(animId);
    };
  }, []);

  return position;
}

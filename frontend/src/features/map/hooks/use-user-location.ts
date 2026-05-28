import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";

export type UserLocation = {
  coords: [number, number];
  heading: number | null;
};

function smoothAngle(prev: number, next: number, alpha: number): number {
  const delta = ((next - prev + 540) % 360) - 180;
  return (prev + alpha * delta + 360) % 360;
}

function smoothCoords(
  prev: [number, number],
  next: [number, number],
  alpha: number
): [number, number] {
  return [
    prev[0] + alpha * (next[0] - prev[0]),
    prev[1] + alpha * (next[1] - prev[1]),
  ];
}

const INTERVAL_MS = 16; // ~60fps smoothing loop

/**
 * @param alpha  Smoothing factor 0–1. Lower = smoother but laggier. Default 0.15.
 */
export function useUserLocation(alpha = 0.15) {
  const [coords, setCoords]   = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const rawCoords              = useRef<[number, number] | null>(null);
  const smoothedCoords         = useRef<[number, number] | null>(null);
  const rawHeading             = useRef<number | null>(null);
  const smoothedHeading        = useRef<number | null>(null);

  useEffect(() => {
    let positionSub: Location.LocationSubscription | null = null;
    let headingSub:  Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Seed the marker from the OS's last cached fix so it appears immediately,
      // instead of waiting for the GPS chip to deliver its first live sample
      // (which can take several seconds on cold start with Accuracy.High).
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          rawCoords.current = [last.coords.longitude, last.coords.latitude];
        }
      } catch {}

      positionSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2 },
        (loc) => { rawCoords.current = [loc.coords.longitude, loc.coords.latitude]; }
      );

      headingSub = await Location.watchHeadingAsync((h) => {
        rawHeading.current = h.trueHeading ?? h.magHeading;
      });
    })();

    const interval = setInterval(() => {
      if (rawCoords.current !== null) {
        smoothedCoords.current =
          smoothedCoords.current === null
            ? rawCoords.current
            : smoothCoords(smoothedCoords.current, rawCoords.current, alpha);
        setCoords(smoothedCoords.current);
      }

      if (rawHeading.current !== null) {
        smoothedHeading.current =
          smoothedHeading.current === null
            ? rawHeading.current
            : smoothAngle(smoothedHeading.current, rawHeading.current, alpha);
        setHeading(smoothedHeading.current);
      }
    }, INTERVAL_MS);

    return () => {
      positionSub?.remove();
      headingSub?.remove();
      clearInterval(interval);
    };
  }, [alpha]);

  if (!coords) return null;
  return { coords, heading };
}

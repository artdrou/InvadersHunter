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
const POSITION_ALPHA = 0.2; // position smoothing factor toward the (possibly dead-reckoned) target
const MIN_RELIABLE_SPEED_MPS = 0.3; // below this, GPS speed/course are noise, not real motion
const MAX_SPEED_MPS = 20; // sanity clamp against occasional GPS glitches (~72 km/h)
const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLon(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

/**
 * @param headingAlpha  Smoothing factor 0–1 for the compass heading. Lower = smoother but laggier. Default 0.15.
 */
export function useUserLocation(headingAlpha = 0.15) {
  const [coords, setCoords]   = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number | null>(null);

  // `rawCoords` is the filter's current target: it snaps to each authoritative GPS fix,
  // then dead-reckons forward every tick using the device's reported speed/course so it
  // keeps moving between fixes instead of sitting still and then jumping on the next one
  // (the "saccadé" behaviour at low speed, where distanceInterval fixes are seconds apart).
  const rawCoords              = useRef<[number, number] | null>(null);
  const smoothedCoords         = useRef<[number, number] | null>(null);
  const speedMps               = useRef(0);
  const courseRad              = useRef<number | null>(null);
  const lastTickAt             = useRef<number | null>(null);
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
        { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
        (loc) => {
          // Authoritative correction: re-anchor the dead-reckoning target to the real fix.
          rawCoords.current = [loc.coords.longitude, loc.coords.latitude];

          const speed = loc.coords.speed;
          speedMps.current =
            speed !== null && speed > MIN_RELIABLE_SPEED_MPS
              ? Math.min(speed, MAX_SPEED_MPS)
              : 0;
          courseRad.current =
            loc.coords.heading !== null && loc.coords.heading >= 0
              ? (loc.coords.heading * Math.PI) / 180
              : null;
        }
      );

      headingSub = await Location.watchHeadingAsync((h) => {
        rawHeading.current = h.trueHeading ?? h.magHeading;
      });
    })();

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = lastTickAt.current === null ? 0 : (now - lastTickAt.current) / 1000;
      lastTickAt.current = now;

      if (rawCoords.current !== null) {
        if (speedMps.current > 0 && courseRad.current !== null && dt > 0) {
          const distMeters = speedMps.current * dt;
          const dLat = (distMeters * Math.cos(courseRad.current)) / METERS_PER_DEG_LAT;
          const dLon =
            (distMeters * Math.sin(courseRad.current)) /
            metersPerDegLon(rawCoords.current[1]);
          rawCoords.current = [rawCoords.current[0] + dLon, rawCoords.current[1] + dLat];
        }

        smoothedCoords.current =
          smoothedCoords.current === null
            ? rawCoords.current
            : smoothCoords(smoothedCoords.current, rawCoords.current, POSITION_ALPHA);
        setCoords(smoothedCoords.current);
      }

      if (rawHeading.current !== null) {
        smoothedHeading.current =
          smoothedHeading.current === null
            ? rawHeading.current
            : smoothAngle(smoothedHeading.current, rawHeading.current, headingAlpha);
        setHeading(smoothedHeading.current);
      }
    }, INTERVAL_MS);

    return () => {
      positionSub?.remove();
      headingSub?.remove();
      clearInterval(interval);
    };
  }, [headingAlpha]);

  if (!coords) return null;
  return { coords, heading };
}

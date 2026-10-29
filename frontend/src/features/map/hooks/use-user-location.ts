import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { PositionFilter, approxDistanceM, smoothAngle, angleDiff } from "../location-filter";

export type UserLocation = {
  coords: [number, number];
  heading: number | null;
};

const INTERVAL_MS = 16; // ~60fps prediction loop
const MIN_RELIABLE_SPEED_MPS = 0.3; // below this, GPS speed/course are noise, not real motion
const MAX_SPEED_MPS = 20; // sanity clamp against occasional GPS glitches (~72 km/h)
const STOPPED_SPEED_ACCURACY_MPS = 0.15; // trust "stopped" a lot, so the dot doesn't overshoot when we halt
// Skip React updates below these changes: the map re-renders on every setState,
// and standing still would otherwise repaint it 60×/s for sub-centimetre drift.
const MIN_MOVE_M = 0.05;
const MIN_TURN_DEG = 0.3;
const MAX_PREDICT_DT_S = 1; // after the app was paused, don't extrapolate the velocity for seconds

/**
 * @param headingAlpha  Smoothing factor 0–1 for the compass heading. Lower = smoother but laggier. Default 0.06
 *                      (0.15 still let the phone's compass jitter show).
 */
export function useUserLocation(headingAlpha = 0.06) {
  const [coords, setCoords]   = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number | null>(null);

  // The Kalman filter predicts the position every tick from its estimated
  // velocity, so the dot keeps moving between GPS fixes instead of sitting
  // still and then jumping (the "saccadé" behaviour at walking speed).
  const filter                 = useRef(new PositionFilter());
  const emittedCoords          = useRef<[number, number] | null>(null);
  const lastTickAt             = useRef<number | null>(null);
  const rawHeading             = useRef<number | null>(null);
  const smoothedHeading        = useRef<number | null>(null);
  const emittedHeading         = useRef<number | null>(null);

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
        if (last && !filter.current.hasFix) {
          filter.current.updatePosition(last.coords.longitude, last.coords.latitude, last.coords.accuracy);
        }
      } catch {}

      positionSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
        (loc) => {
          const f = filter.current;
          f.updatePosition(loc.coords.longitude, loc.coords.latitude, loc.coords.accuracy);

          const speed = loc.coords.speed;
          const course = loc.coords.heading;
          if (speed !== null && speed >= 0 && speed <= MIN_RELIABLE_SPEED_MPS) {
            f.updateVelocity(0, 0, STOPPED_SPEED_ACCURACY_MPS); // OS says we're stopped: kill drift
          } else if (speed !== null && speed > MIN_RELIABLE_SPEED_MPS && course !== null && course >= 0) {
            f.updateVelocity(Math.min(speed, MAX_SPEED_MPS), course);
          }
        }
      );

      headingSub = await Location.watchHeadingAsync((h) => {
        rawHeading.current = h.trueHeading ?? h.magHeading;
      });
    })();

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = lastTickAt.current === null ? 0 : Math.min((now - lastTickAt.current) / 1000, MAX_PREDICT_DT_S);
      lastTickAt.current = now;

      const f = filter.current;
      f.predict(dt);
      const pos = f.position();
      if (pos !== null && (emittedCoords.current === null || approxDistanceM(emittedCoords.current, pos) >= MIN_MOVE_M)) {
        emittedCoords.current = pos;
        setCoords(pos);
      }

      if (rawHeading.current !== null) {
        smoothedHeading.current =
          smoothedHeading.current === null
            ? rawHeading.current
            : smoothAngle(smoothedHeading.current, rawHeading.current, headingAlpha);
        if (emittedHeading.current === null || angleDiff(emittedHeading.current, smoothedHeading.current) >= MIN_TURN_DEG) {
          emittedHeading.current = smoothedHeading.current;
          setHeading(smoothedHeading.current);
        }
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

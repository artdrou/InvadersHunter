// Kalman filter for the user's GPS position. Pure logic (no Expo imports) so it
// can be unit-tested and reused by the hunt view.
//
// Model: constant velocity, in local metres around the first fix. East and north
// are independent, so it runs as two 1D filters (position + velocity each).
// Each GPS fix is weighted by its reported accuracy: a ±5 m fix pulls the dot
// hard, a ±40 m fix (narrow streets, multipath) barely moves it.

const METERS_PER_DEG_LAT = 111_320;
const DEFAULT_ACCURACY_M = 10;   // when the OS gives no accuracy
const MIN_ACCURACY_M = 3;        // GPS never really does better; avoids over-trusting a fix
const ACCEL_NOISE = 0.8;         // m/s² — how fast a walker can change speed/direction
const INITIAL_VEL_VAR = 4;       // (m/s)² — unknown speed on the first fix
const RESET_DISTANCE_M = 300;    // a fix this far from the estimate = teleport (stale seed, tunnel exit)

function metersPerDegLon(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

/** One axis: position p (m), velocity v (m/s), covariance [[a, b], [b, c]]. */
type Axis = { p: number; v: number; a: number; b: number; c: number };

function newAxis(p: number, posVar: number): Axis {
  return { p, v: 0, a: posVar, b: 0, c: INITIAL_VEL_VAR };
}

function predictAxis(s: Axis, dt: number): void {
  const q = ACCEL_NOISE * ACCEL_NOISE;
  const dt2 = dt * dt;
  s.p += s.v * dt;
  // P = F P Fᵀ + Q, with F = [[1, dt], [0, 1]] and white-acceleration noise Q.
  s.a += 2 * dt * s.b + dt2 * s.c + (q * dt2 * dt2) / 4;
  s.b += dt * s.c + (q * dt2 * dt) / 2;
  s.c += q * dt2;
}

function updatePosition(s: Axis, z: number, r: number): void {
  const S = s.a + r;
  const k0 = s.a / S;
  const k1 = s.b / S;
  const y = z - s.p;
  s.p += k0 * y;
  s.v += k1 * y;
  const { a, b } = s;
  s.a = (1 - k0) * a;
  s.b = (1 - k0) * b;
  s.c -= k1 * b;
}

function updateVelocity(s: Axis, z: number, r: number): void {
  const S = s.c + r;
  const k0 = s.b / S;
  const k1 = s.c / S;
  const y = z - s.v;
  s.p += k0 * y;
  s.v += k1 * y;
  const { b, c } = s;
  s.a -= k0 * b;
  s.b = (1 - k1) * b;
  s.c = (1 - k1) * c;
}

export class PositionFilter {
  private origin: [number, number] | null = null;
  private x: Axis | null = null; // east
  private y: Axis | null = null; // north

  get hasFix(): boolean {
    return this.origin !== null;
  }

  /** Advance the estimate by dt seconds (call every frame between fixes). */
  predict(dt: number): void {
    if (!this.x || !this.y || dt <= 0) return;
    predictAxis(this.x, dt);
    predictAxis(this.y, dt);
  }

  /** Correct with a GPS fix. `accuracyM` is the OS's horizontal accuracy (1σ, metres). */
  updatePosition(lon: number, lat: number, accuracyM: number | null | undefined): void {
    const acc = Math.max(accuracyM ?? DEFAULT_ACCURACY_M, MIN_ACCURACY_M);
    if (!this.origin || !this.x || !this.y) {
      this.reset(lon, lat, acc);
      return;
    }
    const [mx, my] = this.toLocal(lon, lat);
    if (Math.hypot(mx - this.x.p, my - this.y.p) > RESET_DISTANCE_M) {
      this.reset(lon, lat, acc);
      return;
    }
    const r = acc * acc;
    updatePosition(this.x, mx, r);
    updatePosition(this.y, my, r);
  }

  /**
   * Correct with the GPS's own speed/course (Doppler-based, smoother than
   * differencing positions). Pass speed 0 when the OS says we're stopped.
   */
  updateVelocity(speedMps: number, courseDeg: number, accuracyMps = 0.5): void {
    if (!this.x || !this.y) return;
    const rad = (courseDeg * Math.PI) / 180;
    const r = accuracyMps * accuracyMps;
    updateVelocity(this.x, speedMps * Math.sin(rad), r);
    updateVelocity(this.y, speedMps * Math.cos(rad), r);
  }

  /** Current estimate as [lon, lat], or null before the first fix. */
  position(): [number, number] | null {
    if (!this.origin || !this.x || !this.y) return null;
    const [lon0, lat0] = this.origin;
    return [lon0 + this.x.p / metersPerDegLon(lat0), lat0 + this.y.p / METERS_PER_DEG_LAT];
  }

  /** Estimated speed in m/s. */
  speed(): number {
    if (!this.x || !this.y) return 0;
    return Math.hypot(this.x.v, this.y.v);
  }

  private reset(lon: number, lat: number, acc: number): void {
    this.origin = [lon, lat];
    this.x = newAxis(0, acc * acc);
    this.y = newAxis(0, acc * acc);
  }

  private toLocal(lon: number, lat: number): [number, number] {
    const [lon0, lat0] = this.origin!;
    return [(lon - lon0) * metersPerDegLon(lat0), (lat - lat0) * METERS_PER_DEG_LAT];
  }
}

/** Approximate distance in metres between two nearby [lon, lat] points. */
export function approxDistanceM(a: [number, number], b: [number, number]): number {
  return Math.hypot((b[0] - a[0]) * metersPerDegLon(a[1]), (b[1] - a[1]) * METERS_PER_DEG_LAT);
}

/** Exponential smoothing on a circle (handles the 359° → 0° wrap). */
export function smoothAngle(prev: number, next: number, alpha: number): number {
  const delta = ((next - prev + 540) % 360) - 180;
  return (prev + alpha * delta + 360) % 360;
}

/** Smallest absolute difference between two angles, in degrees. */
export function angleDiff(a: number, b: number): number {
  return Math.abs(((b - a + 540) % 360) - 180);
}

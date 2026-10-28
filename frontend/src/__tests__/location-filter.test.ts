import { PositionFilter, approxDistanceM, smoothAngle, angleDiff } from "../features/map/location-filter";

const ORIGIN: [number, number] = [2.3522, 48.8566];
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((ORIGIN[1] * Math.PI) / 180);

/** [lon, lat] at (east, north) metres from ORIGIN. */
function at(eastM: number, northM: number): [number, number] {
  return [ORIGIN[0] + eastM / M_PER_DEG_LON, ORIGIN[1] + northM / M_PER_DEG_LAT];
}

/** Deterministic noise in [-1, 1] so the tests never flake. */
function noise(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
}

/** Runs 1 Hz GPS fixes with 60 fps prediction in between. */
function run(f: PositionFilter, fixes: { pos: [number, number]; acc: number }[]) {
  for (const { pos, acc } of fixes) {
    for (let i = 0; i < 60; i++) f.predict(1 / 60);
    f.updatePosition(pos[0], pos[1], acc);
  }
}

describe("PositionFilter", () => {
  it("has no position before the first fix", () => {
    const f = new PositionFilter();
    expect(f.hasFix).toBe(false);
    expect(f.position()).toBeNull();
  });

  it("starts exactly on the first fix", () => {
    const f = new PositionFilter();
    f.updatePosition(ORIGIN[0], ORIGIN[1], 5);
    expect(approxDistanceM(f.position()!, ORIGIN)).toBeLessThan(0.01);
  });

  it("settles near the true point when standing still with noisy fixes", () => {
    const f = new PositionFilter();
    const rnd = noise(42);
    const fixes = Array.from({ length: 30 }, () => ({ pos: at(rnd() * 8, rnd() * 8), acc: 8 }));
    run(f, fixes);
    expect(approxDistanceM(f.position()!, ORIGIN)).toBeLessThan(3);
  });

  it("barely moves on one far-off fix with poor accuracy", () => {
    const f = new PositionFilter();
    run(f, Array.from({ length: 10 }, () => ({ pos: ORIGIN, acc: 5 })));
    f.updatePosition(...at(50, 0), 60);
    expect(approxDistanceM(f.position()!, ORIGIN)).toBeLessThan(5);
  });

  it("follows a good fix more than a bad one", () => {
    const good = new PositionFilter();
    const bad = new PositionFilter();
    for (const f of [good, bad]) run(f, Array.from({ length: 10 }, () => ({ pos: ORIGIN, acc: 5 })));
    good.updatePosition(...at(10, 0), 4);
    bad.updatePosition(...at(10, 0), 40);
    expect(approxDistanceM(good.position()!, ORIGIN)).toBeGreaterThan(approxDistanceM(bad.position()!, ORIGIN));
  });

  it("tracks a straight walk and keeps moving between fixes", () => {
    const f = new PositionFilter();
    const fixes = Array.from({ length: 20 }, (_, i) => ({ pos: at(0, i * 1.4), acc: 5 }));
    run(f, fixes);
    const last = at(0, 19 * 1.4);
    expect(approxDistanceM(f.position()!, last)).toBeLessThan(2);
    expect(f.speed()).toBeGreaterThan(1);
    expect(f.speed()).toBeLessThan(1.8);

    const before = f.position()!;
    for (let i = 0; i < 30; i++) f.predict(1 / 60);
    const after = f.position()!;
    expect(after[1]).toBeGreaterThan(before[1]); // still heading north
  });

  it("uses GPS speed/course to know the direction right away", () => {
    const f = new PositionFilter();
    f.updatePosition(ORIGIN[0], ORIGIN[1], 5);
    f.updateVelocity(1.4, 90); // walking east
    for (let i = 0; i < 60; i++) f.predict(1 / 60);
    const p = f.position()!;
    expect(p[0]).toBeGreaterThan(ORIGIN[0]);
    expect(Math.abs(p[1] - ORIGIN[1]) * M_PER_DEG_LAT).toBeLessThan(0.1);
  });

  it("stops drifting when the OS reports zero speed", () => {
    const f = new PositionFilter();
    run(f, Array.from({ length: 10 }, (_, i) => ({ pos: at(i * 1.4, 0), acc: 5 })));
    f.updateVelocity(0, 0, 0.15);
    expect(f.speed()).toBeLessThan(0.3);
  });

  it("jumps straight to a fix that is far away (stale seed, tunnel exit)", () => {
    const f = new PositionFilter();
    f.updatePosition(ORIGIN[0], ORIGIN[1], 5);
    const far = at(2000, 0);
    f.updatePosition(far[0], far[1], 5);
    expect(approxDistanceM(f.position()!, far)).toBeLessThan(0.01);
  });
});

describe("angle helpers", () => {
  it("smooths across the 0/360 wrap the short way", () => {
    expect(smoothAngle(350, 10, 0.5)).toBeCloseTo(0, 5);
    expect(smoothAngle(10, 350, 0.5)).toBeCloseTo(0, 5);
  });

  it("measures the smallest angle difference", () => {
    expect(angleDiff(350, 10)).toBeCloseTo(20);
    expect(angleDiff(10, 350)).toBeCloseTo(20);
    expect(angleDiff(90, 270)).toBeCloseTo(180);
  });
});

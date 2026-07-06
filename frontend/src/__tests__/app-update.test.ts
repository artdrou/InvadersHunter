import { resolveApkUrl, isNewer } from "../features/app-update/services/app-update.api";
import type { VersionManifest } from "../features/app-update/types";

// ── resolveApkUrl ─────────────────────────────────────────────────────────────

describe("resolveApkUrl", () => {
  const manifest = (url: string): VersionManifest => ({
    latestVersion: "1.0.0",
    url,
    notes: "",
  });

  it("returns an absolute URL unchanged", () => {
    const url = "https://github.com/artdrou/InvadersHunter/releases/download/v1.0.0/InvadersHunter-latest.apk";
    expect(resolveApkUrl(manifest(url))).toBe(url);
  });

  it("returns a relative path concatenated with BASE_URL", () => {
    // BASE_URL is captured at module load time (empty in test env),
    // so relative paths resolve as-is when no EXPO_PUBLIC_API_URL is set.
    const result = resolveApkUrl(manifest("/static/apk/app.apk"));
    expect(result).toMatch(/\/static\/apk\/app\.apk$/);
  });

  it("treats http:// as absolute", () => {
    const url = "http://example.com/app.apk";
    expect(resolveApkUrl(manifest(url))).toBe(url);
  });
});

// ── isNewer ───────────────────────────────────────────────────────────────────

describe("isNewer", () => {
  it("returns true when latest major is higher", () => {
    expect(isNewer("2.0.0", "1.0.0")).toBe(true);
  });

  it("returns true when latest minor is higher", () => {
    expect(isNewer("1.1.0", "1.0.0")).toBe(true);
  });

  it("returns true when latest patch is higher", () => {
    expect(isNewer("1.0.1", "1.0.0")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when current is ahead", () => {
    expect(isNewer("1.0.0", "2.0.0")).toBe(false);
  });

  it("handles different segment counts", () => {
    expect(isNewer("1.1", "1.0.0")).toBe(true);
    expect(isNewer("1.0.0", "1.1")).toBe(false);
  });

  it("treats non-numeric segments as 0", () => {
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
  });
});

/**
 * App-update service — checks a static version manifest hosted on the backend
 * to detect when a new APK is available. Native dependency upgrades can't ship
 * via EAS OTA, so we point users at the latest APK to sideload instead.
 *
 * Manifest URL: ${EXPO_PUBLIC_API_URL}/static/apk/version.json
 */
import Constants from 'expo-constants';
import type { VersionManifest } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const MANIFEST_URL = `${BASE_URL}/static/apk/version.json`;

export function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export async function fetchVersionManifest(): Promise<VersionManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' as RequestCache });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionManifest;
    if (!data.latestVersion || !data.url) return null;
    return data;
  } catch {
    return null;
  }
}

export function resolveApkUrl(manifest: VersionManifest): string {
  if (/^https?:\/\//i.test(manifest.url)) return manifest.url;
  return `${BASE_URL}${manifest.url}`;
}

/** Returns true if `latest` is strictly greater than `current` (dot-separated numeric semver). */
export function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map((n) => parseInt(n, 10) || 0);
  const b = current.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

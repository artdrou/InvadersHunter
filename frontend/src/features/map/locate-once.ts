import * as Location from "expo-location";

/**
 * One-off GPS fix for screens without the main map's live location tracking
 * (e.g. the admin position picker). Last known position first — instant — then
 * a fresh fix. Returns null when permission is denied or no fix is available.
 */
export async function locateOnce(): Promise<{ lat: number; lon: number } | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const pos = (await Location.getLastKnownPositionAsync({ maxAge: 60_000 }))
      ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

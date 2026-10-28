import { Image } from 'expo-image';
import { type Avatar, DEFAULT_AVATAR, sameAvatar, renderAvatarBase64 } from '../types';

// The default icon is the bundled sprite: no drawing needed (and it works where Skia can't).
// Also shown for a shape this app version doesn't know yet.
const DEFAULT_SPRITE = require('../../../../assets/images/marker-20pts-flash-captured.png');
// Drawn once at this size, then scaled (the editor preview is the largest, 160pt)
const RENDER_SIZE = 192;

// The Social list shows the same few icons on every visit: draw each one once
const cache = new Map<string, string | null>();

function avatarUri(a: Avatar): string | null {
  const key = `${a.shape}${a.icon}${a.glow}${a.bloom}`;
  let uri = cache.get(key);
  if (uri === undefined) {
    try {
      const base64 = renderAvatarBase64(a.shape, a.icon, a.glow, RENDER_SIZE, a.bloom);
      uri = base64 ? `data:image/png;base64,${base64}` : null;
    } catch {
      uri = null;  // Skia failed (memory pressure…): fall back to the default sprite
    }
    cache.set(key, uri);
  }
  return uri;
}

/** A player's profile icon (null / undefined = the default one). */
export function PlayerAvatar({ avatar, size }: { avatar: Avatar | null | undefined; size: number }) {
  const uri = avatar && !sameAvatar(avatar, DEFAULT_AVATAR) ? avatarUri(avatar) : null;
  return (
    <Image
      source={uri ? { uri } : DEFAULT_SPRITE}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

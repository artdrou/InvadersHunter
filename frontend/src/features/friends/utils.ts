// Pure helpers (no React / native imports) — unit-tested in __tests__/friends.test.ts.
import type { InvaderWithState } from '@/features/invaders/types';
import type { FriendMapView } from './types';

/**
 * What the map shows for a friend view:
 * - no view → my own flashes, unchanged
 * - "friend" → their flashes in place of mine (blue / red as usual)
 * - "compare" → mine kept, plus `friendCaptured` for the 4-color shared map
 * The popup still uses the real invaders (my flashes), never this output.
 */
export function applyFriendView(invaders: InvaderWithState[], view: FriendMapView | null): InvaderWithState[] {
  if (!view) return invaders;
  const theirs = new Set(view.flashedIds);
  if (view.mode === 'friend') {
    return invaders.map((i) => ({ ...i, isCaptured: theirs.has(i.id), isPending: false }));
  }
  return invaders.map((i) => ({ ...i, friendCaptured: theirs.has(i.id) }));
}

export type FriendRequestError = 'user_not_found' | 'self' | 'already_friends' | 'already_sent' | 'network';

/** Backend `detail` code of a failed invite → the message to show. */
export function friendRequestError(err: unknown): FriendRequestError {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail === 'user_not_found' || detail === 'self' || detail === 'already_friends' || detail === 'already_sent') {
    return detail;
  }
  return 'network';
}

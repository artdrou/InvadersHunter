import { applyFriendView, friendRequestError } from '../features/friends/utils';
import { resolveIconKey } from '../features/map/hooks/use-invader-geojson';
import type { InvaderWithState } from '../features/invaders/types';
import type { FriendMapView } from '../features/friends/types';

function inv(id: number, isCaptured: boolean): InvaderWithState {
  return {
    id, name: `PA_${id}`, latitude: 48, longitude: 2, points: 30, state: 'Good',
    isCaptured, isPending: false,
  } as InvaderWithState;
}

const view = (mode: FriendMapView['mode'], flashedIds: number[]): FriendMapView =>
  ({ userId: 9, username: 'bob', flashedIds, mode });

// ids: 1 = both flashed, 2 = only me, 3 = only friend, 4 = neither
const mine = [inv(1, true), inv(2, true), inv(3, false), inv(4, false)];
const friendIds = [1, 3];

describe('applyFriendView', () => {
  it('returns my invaders unchanged without a view', () => {
    expect(applyFriendView(mine, null)).toBe(mine);
  });

  it("shows the friend's flashes in place of mine", () => {
    const out = applyFriendView(mine, view('friend', friendIds));
    expect(out.map((i) => i.isCaptured)).toEqual([true, false, true, false]);
    expect(out.every((i) => i.friendCaptured === undefined)).toBe(true);
  });

  it('keeps my flashes and adds the friend flag on the shared map', () => {
    const out = applyFriendView(mine, view('compare', friendIds));
    expect(out.map((i) => i.isCaptured)).toEqual([true, true, false, false]);
    expect(out.map((i) => i.friendCaptured)).toEqual([true, false, true, false]);
  });

  it('does not mutate my invaders', () => {
    applyFriendView(mine, view('friend', friendIds));
    expect(mine.map((i) => i.isCaptured)).toEqual([true, true, false, false]);
  });
});

describe('shared map marker colors', () => {
  it('uses blue / green / orange / red for both / me / friend / neither', () => {
    const keys = applyFriendView(mine, view('compare', friendIds)).map((i) => resolveIconKey(i, 'flash', 'none'));
    expect(keys).toEqual([
      'marker-30pts-flash-captured',
      'marker-30pts-flash-mine',
      'marker-30pts-flash-friend',
      'marker-30pts-flash-uncaptured',
    ]);
  });

  it('keeps the normal two colors outside the shared map', () => {
    expect(resolveIconKey(inv(1, true), 'flash', 'none')).toBe('marker-30pts-flash-captured');
    expect(resolveIconKey(inv(2, false), 'flash', 'none')).toBe('marker-30pts-flash-uncaptured');
  });

  it('rarity mode ignores the friend', () => {
    const [both] = applyFriendView(mine, view('compare', friendIds));
    expect(resolveIconKey(both, 'rarity', 'none')).toBe('marker-30pts-rarity');
  });
});

describe('friendRequestError', () => {
  const apiError = (detail: unknown) => ({ response: { data: { detail } } });

  it('maps known backend codes', () => {
    for (const code of ['user_not_found', 'self', 'already_friends', 'already_sent']) {
      expect(friendRequestError(apiError(code))).toBe(code);
    }
  });

  it('falls back to network for anything else', () => {
    expect(friendRequestError(new Error('timeout'))).toBe('network');
    expect(friendRequestError(apiError('Something else'))).toBe('network');
    expect(friendRequestError(undefined)).toBe('network');
  });
});

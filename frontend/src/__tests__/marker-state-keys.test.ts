import { resolveIconKey } from '../features/map/hooks/use-invader-geojson';
import { reactivatedIds } from '../features/reactivations/store';
import { TIER_VALUES, MARKER_DISPLAYS, STATE_GROUPS, markerKey } from '../features/marker-customization/types';
import type { InvaderWithState } from '../features/invaders/types';

function inv(state: string, isCaptured = false, points = 30, id = 1): InvaderWithState {
  return { id, name: 'PA_1', latitude: 48, longitude: 2, points, state, isCaptured, isPending: false } as InvaderWithState;
}

// Every key the generator writes / the bundled registry maps
const ALL_KEYS = new Set(TIER_VALUES.flatMap((tier) =>
  MARKER_DISPLAYS.flatMap((display) => [null, ...STATE_GROUPS].map((group) => markerKey(tier, display, group)))));

describe('state silhouettes in icon keys', () => {
  it('leaves other states on the plain tier key', () => {
    expect(resolveIconKey(inv('Good'), 'flash', 'none')).toBe('marker-30pts-flash-uncaptured');
    expect(resolveIconKey(inv('Degraded', true), 'flash', 'none')).toBe('marker-30pts-flash-captured');
  });

  it('suffixes destroyed and not visible invaders, in every color mode', () => {
    expect(resolveIconKey(inv('Destroyed'), 'flash', 'none')).toBe('marker-30pts-flash-uncaptured-destroyed');
    expect(resolveIconKey(inv('Destroyed', false, 100), 'rarity', 'none')).toBe('marker-100pts-rarity-destroyed');
    expect(resolveIconKey(inv('Destroyed'), 'flash', 'all')).toBe('marker-30pts-grey-destroyed');
    expect(resolveIconKey(inv('Not visible', true), 'flash', 'none')).toBe('marker-30pts-flash-captured-not-visible');
  });

  it('accepts legacy lowercase states', () => {
    expect(resolveIconKey(inv('destroyed'), 'flash', 'none')).toBe('marker-30pts-flash-uncaptured-destroyed');
  });

  it('only produces keys that have an image', () => {
    const invaders = ['Good', 'Degraded', 'Unknown', 'Destroyed', 'Not visible'].flatMap((state) =>
      [false, true].flatMap((captured) => TIER_VALUES.map((pts) => inv(state, captured, pts))));
    for (const i of invaders) {
      for (const colorMode of ['flash', 'rarity', 'state'] as const) {
        for (const greyMode of ['none', 'all', 'unflashed'] as const) {
          expect(ALL_KEYS.has(resolveIconKey(i, colorMode, greyMode, new Set([1])))).toBe(true);
        }
      }
    }
  });
});

describe('State color mode', () => {
  const reactivated = new Set([7]);

  it('colors by condition and is never greyed', () => {
    expect(resolveIconKey(inv('Good'), 'state', 'all')).toBe('marker-30pts-state-good');
    expect(resolveIconKey(inv('Unknown'), 'state', 'all')).toBe('marker-30pts-state-good');
    expect(resolveIconKey(inv('Badly degraded'), 'state', 'all')).toBe('marker-30pts-state-damaged');
    expect(resolveIconKey(inv('Destroyed'), 'state', 'all')).toBe('marker-30pts-state-destroyed-destroyed');
    expect(resolveIconKey(inv('Not visible'), 'state', 'all')).toBe('marker-30pts-state-not-visible-not-visible');
  });

  it('shows recently reactivated invaders as reactivated while they are still up', () => {
    expect(resolveIconKey(inv('Good', false, 30, 7), 'state', 'none', reactivated)).toBe('marker-30pts-state-reactivated');
    expect(resolveIconKey(inv('Degraded', false, 30, 7), 'state', 'none', reactivated)).toBe('marker-30pts-state-reactivated');
    expect(resolveIconKey(inv('Destroyed', false, 30, 7), 'state', 'none', reactivated)).toBe('marker-30pts-state-destroyed-destroyed');
  });
});

describe('reactivatedIds', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const items = [
    { invader_id: 1, date: '2026-10-25T08:00:00' }, // 5 days ago (naive UTC)
    { invader_id: 2, date: '2026-09-20T08:00:00' }, // 40 days ago
  ];

  it('keeps only the last 60 days', () => {
    expect([...reactivatedIds(items, now)].sort()).toEqual([1, 2]);
    expect([...reactivatedIds(items, now + 25 * 24 * 3600 * 1000)]).toEqual([1]); // 2 is now 65 days old
  });
});

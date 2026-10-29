import { resolveIconKey } from '../features/map/hooks/use-invader-geojson';
import { TIER_VALUES, MARKER_DISPLAYS, STATE_GROUPS, markerKey } from '../features/marker-customization/types';
import type { InvaderWithState } from '../features/invaders/types';

function inv(state: string, isCaptured = false, points = 30): InvaderWithState {
  return { id: 1, name: 'PA_1', latitude: 48, longitude: 2, points, state, isCaptured, isPending: false } as InvaderWithState;
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
    const invaders = ['Good', 'Destroyed', 'Not visible'].flatMap((state) =>
      [false, true].flatMap((captured) => TIER_VALUES.map((pts) => inv(state, captured, pts))));
    for (const i of invaders) {
      for (const colorMode of ['flash', 'rarity'] as const) {
        for (const greyMode of ['none', 'all', 'unflashed'] as const) {
          expect(ALL_KEYS.has(resolveIconKey(i, colorMode, greyMode))).toBe(true);
        }
      }
    }
  });
});

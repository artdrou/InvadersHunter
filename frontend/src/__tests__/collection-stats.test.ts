import { computeCollectionStats } from '@/features/invaders/utils/collection-stats';
import type { Invader } from '@/features/invaders/types';

const inv = (id: number, name: string, state = 'Good') => ({ id, name, state }) as Invader;

describe('computeCollectionStats', () => {
  const invaders = [
    inv(1, 'PA_1'), inv(2, 'PA_2', 'Destroyed'), inv(3, 'PA_3'),
    inv(4, 'LY_1'), inv(5, 'LY_2', 'Destroyed'),
  ];

  it('counts flashes, cities, completions and the top city', () => {
    const s = computeCollectionStats(invaders, new Set([1, 2, 4]));
    expect(s.flashed).toBe(3);
    expect(s.citiesWithFlashes).toBe(2);
    expect(s.completeCities).toBe(0);
    expect(s.destroyedFlashed).toBe(1);   // PA_2
    expect(s.remaining).toBe(1);          // PA_3 (LY_2 destroyed is not flashable)
    expect(s.topCity).toEqual({ name: 'PA', captured: 2, total: 3 });
  });

  it('handles a user with no flash', () => {
    const s = computeCollectionStats(invaders, new Set());
    expect(s.flashed).toBe(0);
    expect(s.topCity).toBeNull();
    expect(s.remaining).toBe(3);
  });

  it('counts a fully flashed city as complete', () => {
    expect(computeCollectionStats(invaders, new Set([4, 5])).completeCities).toBe(1);
  });
});

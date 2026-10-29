import { hexToHsv, hsvToHex } from '../features/settings/hsv';

describe('hsv <-> hex', () => {
  it('converts primaries and greys', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000ff');
    expect(hsvToHex({ h: 200, s: 0, v: 0.5 })).toBe('#808080');
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 });
  });

  it('round-trips the palette colors', () => {
    for (const hex of ['#ff0062', '#1cf0ff', '#ffc107', '#a06bff', '#585858', '#002fa7']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });
});

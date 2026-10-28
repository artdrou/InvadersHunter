import { tintSvg } from '@/features/marker-customization/tint';

const TWO_TONE = '<svg><rect fill="#4f4f4f"/><rect fill="#808080"/></svg>';
// HSL lightness of a hex color
const light = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};
const fills = (svg: string) => [...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase());

describe('tintSvg anchored (profile icon shapes)', () => {
  it('keeps the body grey exactly the chosen color', () => {
    const [outline, body] = fills(tintSvg(TWO_TONE, '#ff0000', true));
    expect(body).toBe('#ff0000');
    expect(outline).not.toBe('#ff0000');
  });

  it('keeps the outline darker than the body', () => {
    const [outline, body] = fills(tintSvg(TWO_TONE, '#ff0000', true));
    expect(parseInt(outline.slice(1, 3), 16)).toBeLessThan(parseInt(body.slice(1, 3), 16));
  });

  it('a single-color shape gets the same body as anchored', () => {
    const single = fills(tintSvg('<svg><rect fill="#808080"/></svg>', '#ff0000'));
    expect(single[0]).toBe(fills(tintSvg(TWO_TONE, '#ff0000', true))[1]);
  });

  it('eyes span the same range as a marker with black + white eyes', () => {
    const eyes = '<svg><rect fill="#000000"/><rect fill="#808080"/><rect fill="#ffffff"/></svg>';
    expect(fills(tintSvg(eyes, '#1cf0ff', true))).toEqual(fills(tintSvg(eyes, '#1cf0ff')));
  });

  it('outline sits as far below the body as on the 4-tone markers (50 / 100 pts)', () => {
    const marker = fills(tintSvg('<svg><rect fill="#121212"/><rect fill="#4f4f4f"/><rect fill="#808080"/><rect fill="#ffffff"/></svg>', '#1cf0ff'));
    const [outline, body] = fills(tintSvg(TWO_TONE, '#1cf0ff', true));
    expect(light(body) - light(outline)).toBeCloseTo(light(marker[2]) - light(marker[1]), 2);
  });

  it('default mode is unchanged (rank spread)', () => {
    const [outline, body] = fills(tintSvg(TWO_TONE, '#ff0000'));
    expect(body).not.toBe('#ff0000');
    expect(outline).not.toBe('#ff0000');
  });
});

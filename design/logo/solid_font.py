"""Pixelmania Solid: the app's Pixelmania title font with every glyph filled in.

Pixelmania only draws the outline of its block letters (outer edge, letter-shaped
hole, islands inside the hole). This keeps only the outermost contours, so each glyph
becomes its solid silhouette with the exact same metrics. The arcade titles stack it
under Pixelmania: silhouette (shadow, offset) + silhouette (inside) + Pixelmania
(outline), each in its own theme colour (frontend/src/components/ArcadeTitle.tsx).

    python design/logo/solid_font.py
"""
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/assets/fonts/pixelmania/Pixelmania.ttf"
DST = ROOT / "frontend/assets/fonts/pixelmania/PixelmaniaSolid.ttf"


def _contours(glyph):
    coords, ends = glyph.coordinates, glyph.endPtsOfContours
    start = 0
    for end in ends:
        yield list(coords[start:end + 1]), list(glyph.flags[start:end + 1])
        start = end + 1


def _box(poly):
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def _within(a, b) -> bool:
    """Box a inside box b (pixel outlines: a hole or an island sits within its letter's box)."""
    return a != b and b[0] <= a[0] and b[1] <= a[1] and a[2] <= b[2] and a[3] <= b[3]


def solidify(font: TTFont) -> None:
    glyf = font["glyf"]
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.isComposite() or g.numberOfContours <= 1:
            continue
        contours = list(_contours(g))
        boxes = [_box(pts) for pts, _ in contours]
        keep = [c for c, box in zip(contours, boxes) if not any(_within(box, other) for other in boxes)]
        coords, flags, ends = [], [], []
        for pts, fl in keep:
            coords += pts
            flags += fl
            ends.append(len(coords) - 1)
        g.coordinates = type(g.coordinates)(coords)
        g.flags = type(g.flags)(flags)
        g.endPtsOfContours = ends
        g.numberOfContours = len(ends)
        g.program = type(g.program)()                      # drop hinting tied to removed points
        g.program.fromBytecode(b"")
    for rec in font["name"].names:                          # distinct family name
        if rec.nameID in (1, 4, 6, 16):
            rec.string = str(rec.toUnicode()).replace("Pixelmania", "Pixelmania Solid").replace(
                "PixelmaniaSolid Solid", "PixelmaniaSolid")


if __name__ == "__main__":
    font = TTFont(SRC)
    solidify(font)
    font.save(DST)
    print(DST)

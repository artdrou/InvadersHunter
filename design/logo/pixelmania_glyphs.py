"""Pixelmania tweaks for the arcade titles (frontend/src/components/ArcadeTitle.tsx):
  - adds an underscore, for invader codes like PA_1002
  - narrows the zero by one block, so it doesn't read as an O
  - adds the French capitals with accents: É È Ê Ë À Â Ä Î Ï Ô Ö Ù Û Ü Ç
  - raises the vertical metrics so the accents fit (ArcadeTitle offsets titles by the
    same amount, so they don't move on screen)
and writes the glyph widths + metric changes to frontend/src/constants/pixelmania-metrics.ts.

The underscore is drawn the way Pixelmania draws its letters (see "I"): a face made of
blocks (1 block ≈ 319 units), surrounded by a 214-unit edge, joined with its copy shifted
by the (-537, -527) extrusion — the font's 3D drop toward the bottom left. The face is the
hole of the outline. Accents are plain filled blocks instead: with the edge and the drop,
1-block marks turned into lumps (É, È and Ê looked alike).

Safe to re-run (every glyph is rebuilt from the original letters), then rebuild the solid font:
    python design/logo/pixelmania_glyphs.py
    python design/logo/solid_font.py
"""
from pathlib import Path

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / "frontend/assets/fonts/pixelmania/Pixelmania.ttf"
METRICS = ROOT / "frontend/src/constants/pixelmania-metrics.ts"

BLOCK = 319
EDGE = 214                    # outline thickness around a face
DROP = (537, 527)             # 3D extrusion (left, down)
SIDE_BEARING = 115            # advance = face right + this (same as I, L, E…)
FACE_LEFT, FACE_BOTTOM = 751, -116        # left / bottom of a letter's face (see "I")

# Original vertical metrics: the titles are laid out on these. Android positions text on
# the glyph extremes (head bbox), iOS on hhea ascent / descent.
ORIG_HHEA = (2703, -1171)
ORIG_BBOX_Y = (2329, -1171)

# ── shapes on a pixel grid ────────────────────────────────────────────────────

Rect = tuple[float, float, float, float]  # x0, y0, x1, y1


def block_shape(cells, left, bottom, outlined=True) -> tuple[list[Rect], list[Rect]]:
    """(outer rects, face rects) of a shape made of (col, row) blocks.
    outlined=False: plain filled blocks (no edge, no drop, no face), for small marks."""
    faces = [(left + c * BLOCK, bottom + r * BLOCK, left + (c + 1) * BLOCK, bottom + (r + 1) * BLOCK)
             for c, r in cells]
    if not outlined:
        return faces, []
    dx, dy = DROP
    outer = []
    for x0, y0, x1, y1 in faces:
        grown = (x0 - EDGE, y0 - EDGE, x1 + EDGE, y1 + EDGE)
        outer += [grown, (grown[0] - dx, grown[1] - dy, grown[2] - dx, grown[3] - dy)]
    return outer, faces


def glyph_contours(glyph) -> list[list[tuple[int, int]]]:
    out, start = [], 0
    for end in glyph.endPtsOfContours:
        out.append(list(glyph.coordinates[start:end + 1]))
        start = end + 1
    return out


def _winding(contours, px, py) -> int:
    """Non-zero winding of (px, py) for straight-edged contours (ray toward +x)."""
    w = 0
    for pts in contours:
        for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
            if x1 == x2 and x1 > px and min(y1, y2) < py < max(y1, y2):
                w += 1 if y2 > y1 else -1
    return w


def _inside(rects, px, py) -> bool:
    return any(x0 < px < x1 and y0 < py < y1 for x0, y0, x1, y1 in rects)


def compose(base_contours, parts) -> list[list[tuple[float, float]]]:
    """Contours of base ∪ every part's outer, minus every part's face (parts are in front)."""
    outers = [r for o, _ in parts for r in o]
    faces = [r for _, f in parts for r in f]
    xs = sorted({p[0] for c in base_contours for p in c} | {v for r in outers + faces for v in (r[0], r[2])})
    ys = sorted({p[1] for c in base_contours for p in c} | {v for r in outers + faces for v in (r[1], r[3])})
    edges = set()
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            filled = (_winding(base_contours, cx, cy) != 0 or _inside(outers, cx, cy)) and not _inside(faces, cx, cy)
            if not filled:
                continue
            a, b, c, d = (xs[i], ys[j]), (xs[i], ys[j + 1]), (xs[i + 1], ys[j + 1]), (xs[i + 1], ys[j])
            for e in ((a, b), (b, c), (c, d), (d, a)):        # clockwise, like the font's outer contours
                if (e[1], e[0]) in edges:
                    edges.remove((e[1], e[0]))                 # shared with a filled neighbour
                else:
                    edges.add(e)
    return _trace(edges)


def _trace(edges) -> list[list[tuple[float, float]]]:
    out_of: dict = {}
    for s, e in edges:
        out_of.setdefault(s, []).append(e)
    loops = []
    while out_of:
        start = next(iter(out_of))
        loop, prev, cur = [start], None, start
        while True:
            options = out_of[cur]
            if len(options) > 1 and prev is not None:          # pinch point: turn right first
                d = (cur[0] - prev[0], cur[1] - prev[1])

                def turn(n):
                    v = (n[0] - cur[0], n[1] - cur[1])
                    cross = d[0] * v[1] - d[1] * v[0]
                    return 0 if cross < 0 else (1 if cross == 0 else 2)
                options.sort(key=turn)
            nxt = options.pop(0)
            if not options:
                del out_of[cur]
            prev, cur = cur, nxt
            if cur == start:
                break
            loop.append(cur)
        # drop points in the middle of straight runs
        simple = [p for k, p in enumerate(loop)
                  if not ((loop[k - 1][0] == p[0] == loop[(k + 1) % len(loop)][0])
                          or (loop[k - 1][1] == p[1] == loop[(k + 1) % len(loop)][1]))]
        loops.append(simple)
    return loops


def make_glyph(contours):
    pen = TTGlyphPen(None)
    for pts in contours:
        pen.moveTo(tuple(round(v) for v in pts[0]))
        for p in pts[1:]:
            pen.lineTo(tuple(round(v) for v in p))
        pen.closePath()
    return pen.glyph()

# ── glyphs ───────────────────────────────────────────────────────────────────

# Accents: 3 blocks wide (as wide as the face of "I"), row 0 at the bottom
ACCENTS = {
    "acute": [(0, 0), (1, 0), (1, 1), (2, 1)],
    "grave": [(1, 0), (2, 0), (0, 1), (1, 1)],
    "circumflex": [(0, 0), (2, 0), (1, 1)],
    "dieresis": [(0, 0), (2, 0)],
}
CEDILLA = [(1, 1), (0, 0), (1, 0)]
ACCENT_BOTTOM = 2480          # half a block above the letters' top (≈ 2320)
CEDILLA_TOP = -868            # hangs from the bottom of the C (its drop)

ACCENTED = {
    "É": ("E", "acute"), "È": ("E", "grave"), "Ê": ("E", "circumflex"), "Ë": ("E", "dieresis"),
    "À": ("A", "grave"), "Â": ("A", "circumflex"), "Ä": ("A", "dieresis"),
    "Î": ("I", "circumflex"), "Ï": ("I", "dieresis"),
    "Ô": ("O", "circumflex"), "Ö": ("O", "dieresis"),
    "Ù": ("U", "grave"), "Û": ("U", "circumflex"), "Ü": ("U", "dieresis"),
    "Ç": ("C", "cedilla"),
}


def face_center_x(glyph) -> float:
    # The bbox spans the drop on the left and the edge on the right
    return (glyph.xMin + DROP[0] + glyph.xMax) / 2


def add_glyph(font, char, name, contours, advance):
    if name not in font.getGlyphOrder():
        font.setGlyphOrder(font.getGlyphOrder() + [name])
    glyph = make_glyph(contours)
    font["glyf"][name] = glyph
    glyph.recalcBounds(font["glyf"])
    font["hmtx"][name] = (advance, glyph.xMin)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[ord(char)] = name


def add_underscore(font):
    face_right = FACE_LEFT + 6 * BLOCK                  # about a letter wide (A is 7 blocks)
    parts = [block_shape([(c, 0) for c in range(6)], FACE_LEFT, FACE_BOTTOM)]
    add_glyph(font, "_", "underscore", compose([], parts), face_right + SIDE_BEARING)


def add_accented(font):
    cmap, glyf, hmtx = font.getBestCmap(), font["glyf"], font["hmtx"]
    for char, (base_char, accent) in ACCENTED.items():
        base_name = cmap[ord(base_char)]
        base = glyf[base_name]
        cells = CEDILLA if accent == "cedilla" else ACCENTS[accent]
        cols, rows = max(c for c, _ in cells) + 1, max(r for _, r in cells) + 1
        left = face_center_x(base) - cols * BLOCK / 2
        bottom = CEDILLA_TOP - rows * BLOCK if accent == "cedilla" else ACCENT_BOTTOM
        contours = compose(glyph_contours(base), [block_shape(cells, left, bottom, outlined=False)])
        add_glyph(font, char, base_char + accent, contours, hmtx[base_name][0])


ZERO_WIDTH = 3092             # original advance of "0" (same as "O")
ZERO_SPLIT_X = 1900           # every point right of this moves one block left


def narrow_zero(font: TTFont) -> bool:
    """Shift the zero's right half one block left: inner hole 3 → 2 blocks wide."""
    name = font.getBestCmap()[ord("0")]
    width, lsb = font["hmtx"][name]
    if width != ZERO_WIDTH:
        return False                                     # already narrowed
    glyph = font["glyf"][name]
    glyph.coordinates = type(glyph.coordinates)(
        [(x - BLOCK if x > ZERO_SPLIT_X else x, y) for x, y in glyph.coordinates])
    glyph.recalcBounds(font["glyf"])
    font["hmtx"][name] = (width - BLOCK, lsb)
    return True


def fit_vertical_metrics(font) -> tuple[int, int]:
    """Grow ascent / descent to the tallest glyphs; returns the new (top, bottom) extremes."""
    glyf = font["glyf"]
    top = max(glyf[n].yMax for n in font.getGlyphOrder() if glyf[n].numberOfContours)
    bottom = min(glyf[n].yMin for n in font.getGlyphOrder() if glyf[n].numberOfContours)
    ascent, descent = max(ORIG_HHEA[0], top), min(ORIG_HHEA[1], bottom)
    font["hhea"].ascent, font["hhea"].descent = ascent, descent
    font["OS/2"].usWinAscent, font["OS/2"].usWinDescent = ascent, -descent
    return top, bottom


def write_metrics(font: TTFont, top: int, bottom: int) -> None:
    """Advance widths per character + how much taller the line box got (font units)."""
    cmap, hmtx = font.getBestCmap(), font["hmtx"]
    widths = ", ".join(f"{chr(c)!r}: {hmtx[n][0]}" for c, n in sorted(cmap.items()) if c >= 32)
    hhea = font["hhea"]
    METRICS.write_text(
        "// Generated by design/logo/pixelmania_glyphs.py, do not edit by hand.\n"
        "// Pixelmania (and Pixelmania Solid, same metrics) advance widths, in font units.\n"
        f"export const PIXELMANIA_UNITS_PER_EM = {font['head'].unitsPerEm};\n"
        f"export const PIXELMANIA_ADVANCE: Record<string, number> = {{ {widths} }};\n"
        "// Line box growth from the accents, vs the original font the titles are laid out on\n"
        "// (Android: glyph extremes, iOS: ascent / descent), in font units.\n"
        "export const PIXELMANIA_EXTRA = {\n"
        f"  android: {{ top: {top - ORIG_BBOX_Y[0]}, bottom: {ORIG_BBOX_Y[1] - bottom} }},\n"
        f"  ios: {{ top: {hhea.ascent - ORIG_HHEA[0]}, bottom: {ORIG_HHEA[1] - hhea.descent} }},\n"
        "};\n",
        encoding="utf-8", newline="\n")


if __name__ == "__main__":
    font = TTFont(FONT)
    add_underscore(font)
    narrow_zero(font)
    add_accented(font)
    top, bottom = fit_vertical_metrics(font)
    font.save(FONT)
    print(FONT)
    write_metrics(font, top, bottom)
    print(METRICS)

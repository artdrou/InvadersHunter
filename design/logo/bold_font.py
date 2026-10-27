"""FreePixel Bold: the app's FreePixel font, emboldened the pixel-art way.

FreePixel has no bold, and asking React Native for fontWeight "bold" swaps in the
system font. Each glyph here is its outline plus the same outline shifted one font
pixel (128 units, the font is drawn on a 16-unit grid of 2048) to the right, and the
advance grows by that pixel. Overlapping outlines are filled as one shape (non-zero
winding), which also covers the few glyphs with curves or diagonals.

    python design/logo/bold_font.py
"""
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/assets/fonts/free_pixel/FreePixel.ttf"
DST = ROOT / "frontend/assets/fonts/free_pixel/FreePixelBold.ttf"

PIXEL = 128


def embolden(font: TTFont) -> None:
    glyf, hmtx = font["glyf"], font["hmtx"]
    for name in font.getGlyphOrder():
        g = glyf[name]
        width, lsb = hmtx[name]
        if g.isComposite() or g.numberOfContours <= 0:
            hmtx[name] = (width + PIXEL if width else 0, lsb)
            continue
        n = len(g.coordinates)
        g.coordinates = type(g.coordinates)(list(g.coordinates) + [(x + PIXEL, y) for x, y in g.coordinates])
        g.flags = type(g.flags)(list(g.flags) + list(g.flags))
        g.endPtsOfContours = list(g.endPtsOfContours) + [e + n for e in g.endPtsOfContours]
        g.numberOfContours = len(g.endPtsOfContours)
        g.program = type(g.program)()                     # no hinting for the new points
        g.program.fromBytecode(b"")
        g.recalcBounds(glyf)
        hmtx[name] = (width + PIXEL, g.xMin)
    # A family of its own (regular style), so the system never tries to bold it again;
    # distinct names too: iOS registers fonts by their PostScript name
    names = {1: "Free Pixel Bold", 3: "FreePixelBold-Regular", 4: "Free Pixel Bold", 6: "FreePixelBold-Regular"}
    for rec in font["name"].names:
        if rec.nameID in names:
            rec.string = names[rec.nameID]
    if "DSIG" in font:                                    # the signature no longer matches
        del font["DSIG"]


if __name__ == "__main__":
    font = TTFont(SRC)
    embolden(font)
    font.save(DST)
    print(DST)

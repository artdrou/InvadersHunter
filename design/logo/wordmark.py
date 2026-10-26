"""HintVaders wordmark, drawn from the app's Pixelmania font (frontend/assets/fonts).

Same recipe as the wordmark drafts: a big initial + smaller capitals (the font has no
lowercase), glyph strokes in the bright brand colour, enclosed counters filled with a
dark shade, a soft glow and a little pixel dust.

    python design/logo/wordmark.py            → frontend/assets/images/hintvaders-logo-stacked.png
                                                 (+ -light.png: inverted colours for light themes)
                                                 + login-streets.png (login screen background)
    python design/logo/wordmark.py OUT.png    → somewhere else

Stacked logo = the app-icon duo (android-icon-foreground.png) over "Hint" over
"Vaders", Hint a bit bigger and overlapping Vaders; the duo's halo is softened to
match the text's.
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / "frontend/assets/fonts/pixelmania/Pixelmania.ttf"
DUO = ROOT / "frontend/assets/images/android-icon-foreground.png"
OUT = ROOT / "frontend/assets/images/hintvaders-logo-stacked.png"
STREETS_OUT = ROOT / "frontend/assets/images/login-streets.png"
LOGO_PX, STREETS_PX = 1050, 780     # widths shipped in the app (~3x / 2x a phone screen)

CYAN = dict(stroke=(28, 240, 255), inner=(6, 102, 166), glow=(0, 90, 255))
RED = dict(stroke=(255, 0, 98), inner=(138, 0, 64), glow=(255, 0, 140))

BIG, SMALL = 320, 220          # font sizes of the initial and the other capitals


def _fill_holes(mask: Image.Image) -> Image.Image:
    """Mask + every background region not connected to the outside (the counters)."""
    w, h = mask.size
    padded = Image.new("L", (w + 2, h + 2), 0)
    padded.paste(mask, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)                # outside → 128
    outside = padded.point(lambda v: 255 if v == 128 else 0).crop((1, 1, w + 1, h + 1))
    return ImageChops.invert(outside)


def word(initial: str, rest: str, colours: dict, seed: int, inverted: bool = False) -> Image.Image:
    """inverted (light theme): dark strokes, bright counters."""
    big, small = ImageFont.truetype(str(FONT), BIG), ImageFont.truetype(str(FONT), SMALL)
    pad = BIG   # generous: the glyphs reach well past their nominal box
    width = int(ImageDraw.Draw(Image.new("L", (1, 1))).textlength(initial, font=big)
                + ImageDraw.Draw(Image.new("L", (1, 1))).textlength(rest, font=small)) + 2 * pad
    height = 2 * BIG + 2 * pad
    mask = Image.new("L", (width, height), 0)
    d = ImageDraw.Draw(mask)
    x = pad
    d.text((x, pad), initial, font=big, fill=255)
    big_box = mask.getbbox()
    x += d.textlength(initial, font=big)
    # Small capitals sit on the initial's baseline
    tmp = Image.new("L", (width, height), 0)
    ImageDraw.Draw(tmp).text((x, pad), rest, font=small, fill=255)
    dy = big_box[3] - tmp.getbbox()[3]
    d.text((x, pad + dy), rest, font=small, fill=255)

    solid = _fill_holes(mask)
    glyph = Image.new("RGBA", (width, height))
    stroke, inner = (colours["inner"], colours["stroke"]) if inverted else (colours["stroke"], colours["inner"])
    glyph.paste(inner + (255,), mask=solid)
    glyph.paste(stroke + (255,), mask=mask)

    glow = Image.new("RGBA", (width, height), colours["glow"] + (0,))
    glow.putalpha(solid.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.9)))

    out = Image.new("RGBA", (width, height))
    out.alpha_composite(glow)
    out.alpha_composite(_dust(solid.getbbox(), (width, height), colours["stroke"], seed))
    out.alpha_composite(glyph)
    return out.crop(out.getbbox())


def _dust(box, size, colour, seed, n=26):
    rnd = random.Random(seed)
    layer = Image.new("RGBA", size)
    l, t, r, b = box
    for _ in range(n):
        side = rnd.choice(["top", "bottom", "top", "bottom", "right"])
        x = rnd.uniform(l, r) if side != "right" else rnd.uniform(r - 10, r + 50)
        y = (rnd.uniform(t - 70, t + 10) if side == "top" else
             rnd.uniform(b - 10, b + 70) if side == "bottom" else rnd.uniform(t, b))
        s = rnd.choice([10, 14, 18, 22, 28])
        blur = rnd.choice([0, 0, 0, 3, 6])
        a = int(rnd.uniform(110, 230))
        pad = blur * 3 + 2
        dot = Image.new("RGBA", (s + 2 * pad, s + 2 * pad))
        ImageDraw.Draw(dot).rectangle((pad, pad, pad + s - 1, pad + s - 1), fill=colour + (a,))
        if blur:
            dot = dot.filter(ImageFilter.GaussianBlur(blur))
        layer.alpha_composite(dot, (int(x) - pad, int(y) - pad))
    return layer


def _soften_glow(img: Image.Image, keep: float) -> Image.Image:
    """Scale down the semi-transparent pixels (halo, dust) and keep the opaque sprite pixels,
    so the icon duo's bloom matches the text's."""
    r, g, b, a = img.split()
    a = a.point(lambda v: v if v >= 250 else int(v * keep))
    return Image.merge("RGBA", (r, g, b, a))


def stacked(width=1200, hint_scale=1.12, overlap=0.35, duo_glow=0.5, duo_width=0.95,
            inverted=False) -> Image.Image:
    hint = word("H", "INT", CYAN, seed=3, inverted=inverted)
    vaders = word("V", "ADERS", RED, seed=8, inverted=inverted)
    vw = int(width * 0.86)
    vaders = vaders.resize((vw, round(vaders.height * vw / vaders.width)), Image.LANCZOS)
    k = vaders.height * hint_scale / hint.height
    hint = hint.resize((round(hint.width * k), round(hint.height * k)), Image.LANCZOS)
    duo = _soften_glow(Image.open(DUO).convert("RGBA"), duo_glow)
    duo = duo.crop(duo.getbbox())
    dw = int(width * duo_width)
    duo = duo.resize((dw, round(duo.height * dw / duo.width)), Image.LANCZOS)

    gap, lap = int(width * 0.01), int(vaders.height * overlap)
    W = max(width, hint.width, vaders.width)
    H = duo.height + gap + hint.height + vaders.height - lap
    out = Image.new("RGBA", (W, H))
    out.alpha_composite(duo, ((W - duo.width) // 2, 0))
    y_hint = duo.height + gap
    out.alpha_composite(vaders, ((W - vaders.width) // 2, y_hint + hint.height - lap))
    out.alpha_composite(hint, ((W - hint.width) // 2, y_hint))     # Hint over Vaders
    return out.crop(out.getbbox())


def streets_background(width=1170, height=2532, top=0.85, bottom=0.0, fade_end=0.9) -> Image.Image:
    """Full-screen street grid for the login screen (same generator as the logo / splash
    streets): `top` opacity at the top, fading linearly to `bottom` at `fade_end` of the height."""
    import os
    os.environ.setdefault("LOGO_SCALE", "6")
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    saved_argv = sys.argv
    sys.argv = ["x", str(ROOT), str(Path(__file__).resolve().parent / "out")]
    import variants as V
    sys.argv = saved_argv
    saved = V.W, V.H
    V.W, V.H = width, height
    st = V.streets()
    V.W, V.H = saved
    if st.size != (width, height):
        st = st.resize((width, height), Image.LANCZOS)
    fade = Image.new("L", (1, height))
    for y in range(height):
        t = min(1.0, y / (height * fade_end))
        fade.putpixel((0, y), int(255 * (top + (bottom - top) * t)))
    fade = fade.resize((width, height))
    st.putalpha(ImageChops.multiply(st.split()[3], fade))
    return st


if __name__ == "__main__":
    dst = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    for inverted, path in ((False, dst), (True, dst.with_name(dst.stem + "-light" + dst.suffix))):
        img = stacked(inverted=inverted)
        img = img.resize((LOGO_PX, round(img.height * LOGO_PX / img.width)), Image.LANCZOS)
        img.save(path, optimize=True)
        print(path, img.size)
    if len(sys.argv) == 1:
        bg = streets_background()
        bg = bg.resize((STREETS_PX, round(bg.height * STREETS_PX / bg.width)), Image.LANCZOS)
        bg.save(STREETS_OUT, optimize=True)
        print(STREETS_OUT, bg.size)

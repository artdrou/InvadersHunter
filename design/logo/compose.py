"""Logo draft: gold 100-pt invader in the middle (top), cyan + red tilted on the sides."""
import re, sys, random
from PIL import Image, ImageDraw, ImageFilter

import os
ROOT = sys.argv[1]; OUT = sys.argv[2]
cfg = dict(tilt_l=-14, tilt_r=11, dy_l=42, dy_r=30, overlap=30, scale=3, glow_r=5, glow_k=2.2, gold_main="#808080")
if os.environ.get("LOGO_SCALE"): cfg["scale"] = float(os.environ["LOGO_SCALE"])
for a in sys.argv[3:]:
    k, v = a.split("="); cfg[k] = v if k.startswith("gold") else float(v)

def rects(svg, x0=None, x1=None):
    out = []
    for m in re.finditer(r'<rect x="(\d+)" y="(\d+)" width="10" height="10" fill="(#[0-9A-Fa-f]{6})"/>', svg):
        x, y, c = int(m[1]), int(m[2]), m[3]
        if x0 is None or x0 <= x < x1: out.append((x, y, c))
    return out

def sprite(rs, recolor=None, s=3):
    xs = [r[0] for r in rs]; ys = [r[1] for r in rs]
    ox, oy = min(xs), min(ys)
    w = (max(xs) - ox + 10) * s; h = (max(ys) - oy + 10) * s
    im = Image.new("RGBA", (w, h)); d = ImageDraw.Draw(im)
    for x, y, c in rs:
        c = (recolor or {}).get(c.upper(), c)
        d.rectangle(((x - ox) * s, (y - oy) * s, (x - ox + 10) * s - 1, (y - oy + 10) * s - 1), fill=c)
    return im

def glow(im, color, radius):
    a = im.split()[3].filter(ImageFilter.GaussianBlur(radius))
    g = Image.new("RGBA", im.size, color); g.putalpha(a.point(lambda v: int(v * 0.9)))
    pad = radius * 3
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad))
    out.alpha_composite(g.resize(im.size), (pad, pad))
    big = Image.new("RGBA", out.size); big.alpha_composite(g, (pad, pad))
    big = big.filter(ImageFilter.GaussianBlur(radius))
    big.alpha_composite(im, (pad, pad))
    return big

def shape(points, body, shade=None, mirror=False):
    """Pixel rects of dev/markers/src/shape-<points>.svg recolored: grey body / shade,
    near-black pupils → navy, white eyes kept. `mirror` flips it horizontally."""
    src = rects(open(f"{ROOT}/dev/markers/src/shape-{points}.svg", encoding="utf-8").read())
    tone = {"#808080": body, "#4F4F4F": shade or body}
    out = [(x, y, "#0A0F1E" if c.upper() in ("#121212", "#000000", "#0F0F0F") else tone.get(c.upper(), c)) for x, y, c in src]
    if mirror:
        mx = max(x for x, _, _ in out)
        out = [(mx - x, y, c) for x, y, c in out]
    return out

CYAN_RECTS = shape(50, "#1CF0FF", "#0FA8B8")
RED_RECTS = shape(40, "#FF0062", mirror=True)
cyan = sprite(CYAN_RECTS, s=int(cfg["scale"]))
red = sprite(RED_RECTS, s=int(cfg["scale"]))
gold_map = {"#808080": "#FFCA2A", "#4F4F4F": "#D49F00", "#121212": "#0A0F1E"} if cfg["gold_main"] == "#808080" else \
           {"#4F4F4F": "#FFCA2A", "#808080": "#D49F00", "#121212": "#0A0F1E"}
gold = sprite(rects(open(f"{ROOT}/dev/markers/src/shape-100.svg", encoding="utf-8").read()), gold_map, s=int(cfg["scale"]))

S = int(cfg["scale"])
PAD = int(8 * S * max(1, cfg["glow_r"] / 3))  # room for the glow

def look_up(rects):
    """Move each pupil from the bottom to the top of its eye (swap it with the white cell above)."""
    cells = {(x, y): c for x, y, c in rects}
    out = dict(cells)
    for (x, y), c in cells.items():
        if c.upper() == "#0A0F1E" and cells.get((x, y - 10), "").upper() == "#FFFFFF":
            out[(x, y)], out[(x, y - 10)] = cells[(x, y - 10)], c
    return [(x, y, c) for (x, y), c in out.items()]

def glowed(im, color, radius):
    """(glow layer, sprite layer) on the same padded canvas."""
    sprite_l = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD))
    sprite_l.alpha_composite(im, (PAD, PAD))
    a = sprite_l.split()[3].filter(ImageFilter.GaussianBlur(radius))
    g = Image.new("RGBA", sprite_l.size, color); g.putalpha(a.point(lambda v: min(255, int(v * cfg["glow_k"]))))
    return g, sprite_l

cyan_r = cyan.rotate(cfg["tilt_l"], expand=True, resample=Image.NEAREST)
red_r = red.rotate(cfg["tilt_r"], expand=True, resample=Image.NEAREST)
cyan_g = glowed(cyan_r, (0, 47, 167), int(cfg["glow_r"] * S))
red_g = glowed(red_r, (163, 0, 179), int(cfg["glow_r"] * S))
gold_g = glowed(gold, (212, 120, 0), int(cfg["glow_r"] * S))

def compose(bg=None):
    """Logo on `bg` (None = transparent). Returns (image, placements) where placements
    lists (name, sprite, x, y) of each sprite's top-left inside the image."""
    ov = cfg["overlap"] / 100          # fraction of the gold width each side covers
    gw, gh = gold.width, gold.height
    xl = 0
    xg = cyan_r.width - int(gw * ov)
    xr = xg + gw - int(gw * ov)
    yg = 0
    yl = int(gh * cfg["dy_l"] / 100)
    yr = int(gh * cfg["dy_r"] / 100)
    W = xr + red_r.width + 2 * PAD
    H = max(yg + gh, yl + cyan_r.height, yr + red_r.height) + 2 * PAD
    c = Image.new("RGBA", (W, H), bg or (0, 0, 0, 0))
    layers = ((gold_g, (xg, yg)), (cyan_g, (xl, yl)), (red_g, (xr, yr)))
    # Every glow first, then the sprites: a side's halo never blurs the gold one.
    for (g, _), pos in layers:
        c.alpha_composite(g, pos)
    for (_, sp), pos in layers:
        c.alpha_composite(sp, pos)
    places = [("gold", gold, xg + PAD, yg + PAD), ("cyan", cyan_r, xl + PAD, yl + PAD), ("red", red_r, xr + PAD, yr + PAD)]
    return c, places, layers

if __name__ == "__main__":
    dark, light = compose("#0a0f1e")[0], compose("#f6f7fb")[0]
    sheet = Image.new("RGBA", (dark.width * 2 + 60, dark.height + 40), "#888888")
    sheet.alpha_composite(dark, (20, 20)); sheet.alpha_composite(light, (dark.width + 40, 20))
    sheet.convert("RGB").save(OUT)
    print(sheet.size)

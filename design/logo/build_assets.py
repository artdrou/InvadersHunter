"""Build every logo asset into design/logo/out/.

    python build_assets.py

- logo-full.png        big logo, full detail: map streets + pixel dust + the 3 invaders (transparent)
- logo-trio.png        the 3 invaders with their halo, no streets / dust
- invader-<name>.png   one invader per file, with halo, square 512 (gold / cyan / red)
- invader-<name>.svg   same invader, flat (no halo), crisp at any size
- duo-flat.png / .svg  cyan + red only, tilted and overlapping like in the logo, no effects
- favicon.svg, favicon-32.png, favicon-48.png, apple-touch-icon.png (180): from the flat duo
- sheet.png            contact sheet of everything (dark / light / checkerboard)

compose.py builds the invader arrangement, variants.py the street map and dust.
"""
import math, os, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

# ── Big logo: rendered by variants.py at scale 6 in a separate process ──────────
subprocess.run([sys.executable, "-c", (
    "import sys; sys.path.insert(0, r'%s'); sys.argv = ['x', r'%s', r'%s'];"
    "import variants as V; V.build('C').save(r'%s')"
) % (HERE, ROOT, OUT, OUT / "logo-full.png")], check=True, env={**os.environ, "LOGO_SCALE": "6"})

# ── Everything else reuses compose.py at its default scale ─────────────────────
sys.path.insert(0, str(HERE))
sys.argv = ["x", str(ROOT), str(OUT / "unused.png")]
import compose as C

def trim(im, margin=0.06):
    box = im.getbbox()
    im = im.crop(box)
    m = int(max(im.size) * margin)
    out = Image.new("RGBA", (im.width + 2 * m, im.height + 2 * m))
    out.alpha_composite(im, (m, m))
    return out

trio, _, _ = C.compose(None)
trim(trio).save(OUT / "logo-trio.png")

# Invader pixel data, straight from the sources compose.py uses.
logo_svg = (ROOT / "backend/static/site/img/logo.svg").read_text(encoding="utf-8")
GOLD = {"#808080": "#FFCA2A", "#4F4F4F": "#D49F00", "#121212": "#0A0F1E"}
INVADERS = {
    "gold": ([(x, y, GOLD.get(c.upper(), c)) for x, y, c in C.rects((ROOT / "dev/markers/src/shape-100.svg").read_text(encoding="utf-8"))], (212, 120, 0)),
    "cyan": (C.rects(logo_svg, 0, 120), (0, 47, 167)),
    "red": (C.rects(logo_svg, 150, 260), (163, 0, 179)),
}

def cells(rs):
    """Rects in 10-unit cells → [(col, row, color)] starting at 0, plus (cols, rows)."""
    xs = [x for x, _, _ in rs]; ys = [y for _, y, _ in rs]
    ox, oy = min(xs), min(ys)
    cl = [((x - ox) // 10, (y - oy) // 10, c) for x, y, c in rs]
    return cl, (max(c for c, _, _ in cl) + 1, max(r for _, r, _ in cl) + 1)

def pixel_sprite(rs, cell):
    cl, (w, h) = cells(rs)
    im = Image.new("RGBA", (w * cell, h * cell)); d = ImageDraw.Draw(im)
    for c, r, col in cl:
        d.rectangle((c * cell, r * cell, (c + 1) * cell - 1, (r + 1) * cell - 1), fill=col)
    return im

def with_halo(sprite, color, radius):
    pad = int(radius * 3)
    out = Image.new("RGBA", (sprite.width + 2 * pad, sprite.height + 2 * pad))
    out.alpha_composite(sprite, (pad, pad))
    a = out.split()[3].filter(ImageFilter.GaussianBlur(radius))
    glow = Image.new("RGBA", out.size, color + (0,)); glow.putalpha(a.point(lambda v: min(255, int(v * C.cfg["glow_k"]))))
    glow.alpha_composite(out)
    return glow

def square(im, size):
    out = Image.new("RGBA", (size, size))
    out.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return out

# ── One invader per file: halo PNG (512) + flat SVG ─────────────────────────────
def svg_of(groups, size_w, size_h):
    """groups: [(cells, cols, rows, x, y, cell, deg)] → one SVG of pixel rects."""
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size_w:.0f} {size_h:.0f}" shape-rendering="crispEdges">']
    for cl, w, h, x, y, cell, deg in groups:
        cx, cy = x + w * cell / 2, y + h * cell / 2
        parts.append(f'  <g transform="rotate({deg} {cx:.1f} {cy:.1f})">')
        parts += [f'    <rect x="{x + c * cell:.1f}" y="{y + r * cell:.1f}" width="{cell}" height="{cell}" fill="{col}"/>' for c, r, col in cl]
        parts.append("  </g>")
    parts.append("</svg>")
    return "\n".join(parts) + "\n"

for name, (rs, glow) in INVADERS.items():
    cl, (w, h) = cells(rs)
    cell = int(512 * 0.62 / max(w, h))
    sprite = pixel_sprite(rs, cell)
    square(with_halo(sprite, glow, cell * 0.5), 512).save(OUT / f"invader-{name}.png")
    pad = 1
    (OUT / f"invader-{name}.svg").write_text(svg_of([(cl, w, h, pad, pad, 1, 0)], w + 2 * pad, h + 2 * pad), encoding="utf-8")

# ── Duo: cyan + red, tilted and overlapping like in the logo, no effects ────────
def duo_layout(cell):
    (cc, (cw, chh)), (rc, (rw, rh)) = cells(INVADERS["cyan"][0]), cells(INVADERS["red"][0])
    x_red = cw * cell * 0.82          # red overlaps the cyan's right edge a little
    y_cyan, y_red = rh * cell * 0.22, 0  # uneven heights: red a bit higher
    return [(cc, cw, chh, 0, y_cyan, cell, C.cfg["tilt_l"]), (rc, rw, rh, x_red, y_red, cell, C.cfg["tilt_r"])]

def render_duo(cell):
    groups = duo_layout(cell)
    W = int(max(x + w * cell for _, w, _, x, _, _, _ in groups)) + 4 * cell
    H = int(max(y + h * cell for _, _, h, _, y, _, _ in groups)) + 4 * cell
    canvas = Image.new("RGBA", (W, H))
    for cl, w, h, x, y, c, deg in reversed(groups):   # red first, cyan in front (as in the logo)
        sp = Image.new("RGBA", (w * c, h * c)); d = ImageDraw.Draw(sp)
        for cc_, rr, col in cl:
            d.rectangle((cc_ * c, rr * c, (cc_ + 1) * c - 1, (rr + 1) * c - 1), fill=col)
        sp = sp.rotate(deg, expand=True, resample=Image.NEAREST)   # same sense as compose.py
        cx, cy = 2 * cell + x + w * c / 2, 2 * cell + y + h * c / 2
        canvas.alpha_composite(sp, (int(cx - sp.width / 2), int(cy - sp.height / 2)))
    return trim(canvas, 0.04)

duo = render_duo(24)
duo.save(OUT / "duo-flat.png")
groups = duo_layout(10)
vb_w = max(x + w * 10 for _, w, _, x, _, _, _ in groups) + 40
vb_h = max(y + h * 10 for _, _, h, _, y, _, _ in groups) + 40
shifted = [(cl, w, h, x + 20, y + 20, c, -deg) for cl, w, h, x, y, c, deg in reversed(groups)]
(OUT / "duo-flat.svg").write_text(svg_of(shifted, vb_w, vb_h), encoding="utf-8")
(OUT / "favicon.svg").write_text(svg_of(shifted, vb_w, vb_h), encoding="utf-8")
sq = square(duo, max(duo.size))
for size, name in ((32, "favicon-32.png"), (48, "favicon-48.png"), (180, "apple-touch-icon.png")):
    sq.resize((size, size), Image.LANCZOS).save(OUT / name)

# ── Contact sheet ───────────────────────────────────────────────────────────────
def checker(w, h, s=16):
    c = Image.new("RGBA", (w, h), (205, 205, 205, 255)); d = ImageDraw.Draw(c)
    for y in range(0, h, s):
        for x in range((y // s % 2) * s, w, 2 * s): d.rectangle((x, y, x + s - 1, y + s - 1), fill=(235, 235, 235, 255))
    return c

items = ["logo-full.png", "logo-trio.png", "invader-gold.png", "invader-cyan.png", "invader-red.png", "duo-flat.png", "favicon-48.png"]
cellw, cellh = 420, 260
sheet = Image.new("RGB", (cellw * 3 + 80, (cellh + 40) * len(items) + 20), "#555555"); dd = ImageDraw.Draw(sheet)
for r, name in enumerate(items):
    im = Image.open(OUT / name).convert("RGBA")
    scale = min((cellw - 20) / im.width, (cellh - 20) / im.height, 1 if name.startswith("favicon") else 99)
    im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.NEAREST if name.startswith("favicon") else Image.LANCZOS)
    for cidx, bg in enumerate([Image.new("RGBA", (cellw, cellh), "#0a0f1e"), Image.new("RGBA", (cellw, cellh), "#f6f7fb"), checker(cellw, cellh)]):
        bg.alpha_composite(im, ((cellw - im.width) // 2, (cellh - im.height) // 2))
        sheet.paste(bg.convert("RGB"), (20 + cidx * (cellw + 20), 30 + r * (cellh + 40)))
    full = Image.open(OUT / name)
    dd.text((20, 12 + r * (cellh + 40)), f"{name}  ({full.width}x{full.height})", fill="white")
sheet.save(OUT / "sheet.png")
(OUT / "unused.png").unlink(missing_ok=True)
print("ok", sorted(p.name for p in OUT.iterdir()))

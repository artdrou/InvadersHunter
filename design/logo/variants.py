"""4 background / motion variants behind the chosen logo, all on a transparent canvas."""
import sys, math, random
ROOT, OUTDIR = sys.argv[1], sys.argv[2]
sys.argv = [sys.argv[0], ROOT, "unused.png"]
import compose as C
from PIL import Image, ImageDraw, ImageFilter, ImageChops

logo, places, layers = C.compose(None)
S = C.S
M = int(logo.width * 0.22)                        # margin around the logo for the background
W, H = logo.width + 2 * M, logo.height + 2 * M
ROAD = (52, 82, 125)                              # darkMapPalette.road (#34527d)
CASING = (27, 47, 77)
COL = {"cyan": (28, 240, 255), "red": (255, 0, 98), "gold": (255, 202, 42)}

def fade_mask(strength=1.0):
    """Elliptic radial fade: opaque around the logo, transparent at the edges."""
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    steps = 60
    for i in range(steps):
        t = i / steps
        a = int(255 * (t ** 1.6) * strength)
        rx, ry = W / 2 * (1 - t * 0.78), H / 2 * (1 - t * 0.78)
        d.ellipse((W / 2 - rx, H / 2 - ry, W / 2 + rx, H / 2 + ry), fill=a)
    return m.filter(ImageFilter.GaussianBlur(S * 6))

def _clip(poly, p, n, keep_pos):
    """Sutherland-Hodgman: part of convex `poly` on one side of the line through p with normal n."""
    side = lambda q: (q[0] - p[0]) * n[0] + (q[1] - p[1]) * n[1]
    out = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        sa, sb = side(a), side(b)
        ina, inb = (sa >= 0) == keep_pos, (sb >= 0) == keep_pos
        if ina: out.append(a)
        if ina != inb and sa != sb:
            t = sa / (sa - sb)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out

def _area(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))) / 2

def _cut(poly, p, d):
    """Split convex poly by the line (p, direction d). Returns (part1, part2, segment) or None."""
    n = (-d[1], d[0])
    a, b = _clip(poly, p, n, True), _clip(poly, p, n, False)
    if len(a) < 3 or len(b) < 3: return None
    side = lambda q: abs((q[0] - p[0]) * n[0] + (q[1] - p[1]) * n[1]) < 1e-6
    on = [q for q in a if side(q)]
    if len(on) < 2: return None
    return a, b, (on[0], on[-1])

def streets(seed=7):
    """City-like street map in the spirit of a real Paris extract: a few long straight
    boulevards meeting on "places", then blocks recursively split by short streets
    roughly perpendicular to their longest side (T-junctions, local grids that change
    orientation from one district to the next), plus a curved canal."""
    rnd = random.Random(seed)
    SS = 2
    U = SS * S / 3   # street widths follow the logo scale
    Wp, Hp = W * SS, H * SS
    im = Image.new("RGBA", (Wp, Hp)); d = ImageDraw.Draw(im)
    gx = (M + places[0][2] + places[0][1].width / 2) * SS
    gy = (M + places[0][3] + places[0][1].height * 0.6) * SS

    polys = [[(0, 0), (Wp, 0), (Wp, Hp), (0, Hp)]]
    major, minor = [], []
    # Boulevards: three meeting on a place behind the gold invader, three crossing elsewhere.
    lines = [((gx, gy), a) for a in (rnd.uniform(-35, -20), rnd.uniform(15, 30), rnd.uniform(70, 95))]
    lines += [((rnd.uniform(0.1, 0.9) * Wp, rnd.uniform(0.1, 0.9) * Hp), rnd.uniform(0, 180)) for _ in range(3)]
    for p, deg in lines:
        dv = (math.cos(math.radians(deg)), math.sin(math.radians(deg)))
        nxt = []
        for poly in polys:
            r = _cut(poly, p, dv)
            if r: nxt += [r[0], r[1]]; major.append(r[2])
            else: nxt.append(poly)
        polys = nxt
    # Blocks: split along the longest side until the block is small.
    min_area = (Wp * Hp) / 420
    queue, blocks = polys, []
    while queue:
        poly = queue.pop()
        if _area(poly) < min_area * rnd.uniform(0.6, 1.8):
            blocks.append(poly); continue
        i = max(range(len(poly)), key=lambda k: math.dist(poly[k], poly[(k + 1) % len(poly)]))
        a, b = poly[i], poly[(i + 1) % len(poly)]
        t = rnd.uniform(0.35, 0.65)
        p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        ang = math.atan2(b[1] - a[1], b[0] - a[0]) + math.pi / 2 + math.radians(rnd.uniform(-12, 12))
        r = _cut(poly, p, (math.cos(ang), math.sin(ang)))
        if not r: blocks.append(poly); continue
        queue += [r[0], r[1]]
        minor.append((r[2], rnd.random() < 0.18))   # a few wider streets ("rues" vs "ruelles")

    def road(seg, w, color): d.line(seg, fill=color + (255,), width=int(w))
    for seg, wide in minor: road(seg, (4 if wide else 2.5) * U, ROAD)
    # canal: a gentle curve in the water color, under the boulevards
    WATER = (16, 48, 80)
    cx0 = rnd.uniform(0.2, 0.35) * Wp
    pts = [(cx0 + math.sin(y / Hp * 2.2) * Wp * 0.06 + y * 0.18, y) for y in range(0, Hp + 1, 8)]
    d.line(pts, fill=(60, 110, 160, 255), width=int(7 * U))
    for seg in major: road(seg, 11 * U, CASING)
    for seg in major: road(seg, 7 * U, ROAD)
    # the place: a small round where the three boulevards meet
    d.ellipse((gx - 16 * U, gy - 16 * U, gx + 16 * U, gy + 16 * U), fill=ROAD + (255,))
    return im.resize((W, H), Image.LANCZOS)

def with_fade(layer, mask, k=0.8):
    a = ImageChops.multiply(layer.split()[3], mask.point(lambda v: int(v * k)))
    layer = layer.copy(); layer.putalpha(a); return layer

def trails(base):
    """Ghost copies under each invader, as if they were rising out of the street."""
    for name, sp, x, y in places:
        dx = {"cyan": -1, "red": 1, "gold": 0}[name]
        for i, alpha in ((3, 0.16), (2, 0.28), (1, 0.45)):
            ghost = sp.copy(); ghost.putalpha(ghost.split()[3].point(lambda v: int(v * alpha)))
            base.alpha_composite(ghost, (M + x + dx * i * 9 * S // 3, M + y + i * 14 * S // 3))

def speed_lines(base, seed=3):
    rnd = random.Random(seed); d = ImageDraw.Draw(base)
    for name, sp, x, y in places:
        c = COL[name]
        for _ in range(4 if name != "gold" else 3):
            yy = M + y + rnd.randint(sp.height // 5, sp.height * 4 // 5)
            if name == "gold":
                xx = M + x + rnd.randint(sp.width // 5, sp.width * 4 // 5); ln = rnd.randint(16, 30) * S
                d.line([(xx, yy + sp.height // 2), (xx, yy + sp.height // 2 + ln)], fill=c + (70,), width=2 * S)
            else:
                ln = rnd.randint(18, 40) * S
                x0 = M + x - 6 * S if name == "cyan" else M + x + sp.width + 6 * S
                x1 = x0 - ln if name == "cyan" else x0 + ln
                d.line([(x0, yy), (x1, yy + ln // 3)], fill=c + (85,), width=2 * S)

def particles(base, seed=11, n=150, front=False):
    """Pixel dust clustered around each invader: dense close to it, sparse further out.
    Each dot gets its own size and blur (depth of field); far dots are fainter."""
    rnd = random.Random(seed)
    for _ in range(n):
        name, sp, x, y = rnd.choice(places + [places[0]])          # gold a bit more
        cx, cy = M + x + sp.width / 2, M + y + sp.height / 2
        reach = max(sp.width, sp.height) / 2
        dist = reach * (0.7 + rnd.expovariate(1 / 0.38))         # mostly near the edge, a long tail
        a = rnd.uniform(0, 2 * math.pi)
        px, py = cx + dist * math.cos(a), cy + dist * math.sin(a) * 0.8
        if not (0 <= px < W and 0 <= py < H):
            continue
        far = min(1, (dist / reach - 0.75) / 1.6)                  # 0 near → 1 far
        sz = max(3, int(rnd.choice([2, 3, 3, 4, 5, 6, 8]) * S * (1 - 0.45 * far)))
        blur = rnd.choice([0, 0, 0, 0.8, 1.5, 3]) * S
        alpha = int(rnd.uniform(170, 255) * (1 - 0.75 * far))
        pad = int(blur * 3) + 2
        dot = Image.new("RGBA", (sz + 2 * pad, sz + 2 * pad))
        ImageDraw.Draw(dot).rectangle((pad, pad, pad + sz - 1, pad + sz - 1), fill=COL[name] + (alpha,))
        if blur:
            dot = dot.filter(ImageFilter.GaussianBlur(blur))
        base.alpha_composite(dot, (int(px) - pad, int(py) - pad))

def route(base):
    """Dotted glowing hunt route (the app's itinerary green) passing behind the logo."""
    pts = []
    for i in range(0, 101):
        t = i / 100
        pts.append((W * (0.05 + 0.9 * t), H * (0.86 - 0.5 * t) + math.sin(t * math.pi * 2.2) * H * 0.08))
    layer = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(layer)
    for i in range(0, len(pts) - 1, 2):
        d.line([pts[i], pts[i + 1]], fill=(80, 255, 170, 255), width=4 * S)
    glow = layer.filter(ImageFilter.GaussianBlur(4 * S))
    base.alpha_composite(with_fade(glow, fade_mask(), 0.9))
    base.alpha_composite(with_fade(layer, fade_mask(), 0.75))
    pins = Image.new("RGBA", (W, H)); d2 = ImageDraw.Draw(pins)
    for i in (22, 80):                            # start / end pins, inside the visible zone
        x, y = pts[i]
        d2.ellipse((x - 6 * S, y - 6 * S, x + 6 * S, y + 6 * S), fill=(80, 255, 170, 255))
    base.alpha_composite(with_fade(pins, fade_mask(), 0.9))

def build(kind):
    base = Image.new("RGBA", (W, H))
    base.alpha_composite(with_fade(streets(), fade_mask()))
    if kind == "D": route(base)
    if kind == "B": trails(base)
    if kind == "C": particles(base)
    base.alpha_composite(logo, (M, M))
    if kind == "C": particles(base, seed=5, n=14)  # a few in front of the invaders
    return base

if __name__ == "__main__":
    out = {}
    for k in "C":
        im = build(k); im.save(f"{OUTDIR}/bg-{k}2.png"); out[k] = im
    # Contact sheet: each variant on the dark page, the light page and a checkerboard (transparency).
    def checker(w, h, s=24):
        c = Image.new("RGBA", (w, h), (200, 200, 200, 255)); d = ImageDraw.Draw(c)
        for y in range(0, h, s):
            for x in range((y // s % 2) * s, w, 2 * s): d.rectangle((x, y, x + s - 1, y + s - 1), fill=(235, 235, 235, 255))
        return c
    tw = W // 3; th = H // 3
    tw, th = W // 2, H // 2
    sheet = Image.new("RGB", (tw * 3 + 80, th + 70), "#666666"); dd = ImageDraw.Draw(sheet)
    for r, k in enumerate("C"):
        small = out[k].resize((tw, th), Image.LANCZOS)
        for cidx, bg in enumerate([Image.new("RGBA", (tw, th), "#0a0f1e"), Image.new("RGBA", (tw, th), "#f6f7fb"), checker(tw, th)]):
            bg.alpha_composite(small); sheet.paste(bg.convert("RGB"), (20 + cidx * (tw + 20), 40 + r * (th + 50)))
        dd.text((20, 18 + r * (th + 50)), "Variante C v2", fill="white")
    sheet.save(f"{OUTDIR}/bg-sheet-C2.png"); print(sheet.size, (W, H))

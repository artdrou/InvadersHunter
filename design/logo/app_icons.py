"""Build every icon / splash asset of the mobile app into frontend/assets/images/.

    backend/venv/Scripts/python.exe design/logo/app_icons.py

Same artwork as the website (compose.py = the invaders, variants.py = the street map and dust).
The icons use the cyan + red duo, the splash the full logo (gold included):

- icon.png                          1024, opaque: navy + streets + the duo with a little dust (store / iOS / legacy Android)
- icon-dev.png / icon-stag.png      same on a red / blue background + "DEV" / "STAG" label (dev / staging builds)
- android-icon-foreground.png       1024, transparent: the duo inside the adaptive-icon safe zone
- android-icon-foreground-dev/stag  same + label
- android-icon-background.png       1024, opaque: navy + streets (tinted for -dev / -stag)
- android-icon-monochrome.png       1024, white silhouettes (Android 13 themed icons)
- splash-icon.png                   1024: the full website logo (3 invaders, halo, dust) over the street grid, faded on the outer 20 %
- notification-icon.png             100, white cyan-invader silhouette filling 99 %, same lines as the themed icon (status bar: Android keeps alpha only)
- favicon.png                       48, the flat duo (same as the website favicon)
- design/logo/out/app-icons-preview.png   contact sheet (not used by the app)
"""
import math, os, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DST = ROOT / "frontend/assets/images"
FONT = ROOT / "frontend/assets/fonts/dogica/TTF/dogicapixelbold.ttf"
NAVY = (10, 15, 30)  # theme.bg (#0a0f1e)
SIZE = 1024

# Render at scale 6 so nothing gets upscaled (compose.py / variants.py read these at import).
os.environ["LOGO_SCALE"] = "6"
sys.path.insert(0, str(HERE))
sys.argv = ["x", str(ROOT), str(HERE / "out")]
import variants as V
C = V.C

DUST = dict(n=90, front=6, alpha=0.75)  # pixel dust around the duo: sparse, a bit faded

def duo_art(overlap=0.68):
    """Cyan + red with their halos, laid out like the website duo: red overlapping the
    cyan's right edge, a bit higher, cyan in front, with a little pixel dust. The red
    starts at `overlap` x the cyan's width: lower = more overlap.
    Returns (image, places of each sprite in drawing order, box of the invaders + halos in it):
    sizes are fitted on that box, so the dust can spill past it without shrinking the invaders."""
    xr, yc = int(C.cyan_r.width * overlap), int(C.red_r.height * 0.22)  # rotated boxes have empty corners
    m = C.PAD * 2                                                    # room for the dust
    layers = [(C.red_g, (m + xr, m), "red", C.red_r), (C.cyan_g, (m, m + yc), "cyan", C.cyan_r)]
    W = max(pos[0] + g.width for (g, _), pos, _, _ in layers) + m
    H = max(pos[1] + g.height for (g, _), pos, _, _ in layers) + m
    places = [(name, sp, pos[0] + C.PAD, pos[1] + C.PAD) for _, pos, name, sp in layers]
    def dust(seed, n):
        # variants.particles() scatters around its module's `places` on a W x H canvas offset by M
        saved = V.places, V.W, V.H, V.M
        V.places, V.W, V.H, V.M = places[::-1], W, H, 0  # it favors places[0]: the cyan
        layer = Image.new("RGBA", (W, H)); V.particles(layer, seed=seed, n=n)
        V.places, V.W, V.H, V.M = saved
        layer.putalpha(layer.split()[3].point(lambda v: int(v * DUST["alpha"])))
        return layer
    im = Image.new("RGBA", (W, H))
    for (g, _), pos, _, _ in layers: im.alpha_composite(g, pos)
    l, t, r, b = im.getbbox()
    e = C.PAD                                                        # how far the dust may spill
    crop = (l - e, t - e, r + e, b + e)
    im.alpha_composite(dust(11, DUST["n"]))
    for (_, sp), pos, _, _ in layers: im.alpha_composite(sp, pos)
    im.alpha_composite(dust(5, DUST["front"]))
    return im.crop(crop), [(n, sp, x - crop[0], y - crop[1]) for n, sp, x, y in places], (e, e, e + r - l, e + b - t)

def radial_fade(size, radius, band):
    """L mask, 0 inside → 255 at `radius` (and beyond), smoothstep over the outer `band`
    fraction of the radius."""
    m = Image.new("L", (size, size)); px = m.load()
    for y in range(size):
        for x in range(size):
            t = min(1, max(0, (math.hypot(x - size / 2 + .5, y - size / 2 + .5) / radius - (1 - band)) / band))
            px[x, y] = int(255 * t * t * (3 - 2 * t))
    return m

def full_logo_square():
    """The website logo (3 invaders, halo, dust) over the street grid, which fades out over
    the outer 20 % of the diameter of the circle inscribed in the square (also what Android 12+
    shows of the splash), so it reads the same as a square or a circle."""
    side = max(V.W, V.H)
    saved = V.W, V.H
    V.W = V.H = side                                    # streets() draws on a V.W x V.H canvas
    st = V.streets()
    V.W, V.H = saved
    keep = ImageChops.invert(radial_fade(side, side / 2, band=0.4))
    st.putalpha(ImageChops.multiply(st.split()[3].point(lambda v: int(v * 0.8)), keep))  # 0.8: as on the website
    out = Image.new("RGBA", (side, side)); out.alpha_composite(st)
    logo = Image.new("RGBA", (V.W, V.H))                # variants.build("C") minus the fade
    V.particles(logo); logo.alpha_composite(V.logo, (V.M, V.M)); V.particles(logo, seed=5, n=14)
    out.alpha_composite(logo, ((side - V.W) // 2, (side - V.H) // 2))
    return out

FULL_LOGO = full_logo_square()

# In the app icons the cyan looks up-right, at the red (which looks down-left): they face each
# other. The splash above keeps the website logo as is, so this comes after FULL_LOGO.
C.CYAN_RECTS = C.look_up(C.CYAN_RECTS)
C.cyan = C.sprite(C.CYAN_RECTS, s=C.S)
C.cyan_r = C.cyan.rotate(C.cfg["tilt_l"], expand=True, resample=Image.NEAREST)
C.cyan_g = C.glowed(C.cyan_r, (0, 47, 167), int(C.cfg["glow_r"] * C.S))
ART, PLACES, CORE = duo_art()
# Prod adaptive icon: the duo a little bigger, overlapping more, so it fills the circle.
ADAPTIVE = duo_art(overlap=0.58)

def fit(im, max_w, max_h, core=None):
    """Resize `im` so that `core` (a box inside it, default: all of it) fits max_w x max_h."""
    l, t, r, b = core or (0, 0, im.width, im.height)
    k = min(max_w / (r - l), max_h / (b - t))
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)

def centered(im, size=SIZE, dy=0):
    out = Image.new("RGBA", (size, size))
    x, y = (size - im.width) // 2, (size - im.height) // 2 + dy
    # alpha_composite refuses negative offsets: crop what overflows (the dust) first
    im = im.crop((max(0, -x), max(0, -y), min(im.width, size - x), min(im.height, size - y)))
    out.alpha_composite(im, (max(0, x), max(0, y)))
    return out

# ── Background: navy + the street map, brighter in the middle ───────────────────
def background(tint=None):
    st = V.streets()
    side = min(st.size)
    st = st.crop(((st.width - side) // 2, (st.height - side) // 2, (st.width + side) // 2, (st.height + side) // 2))
    st = st.resize((SIZE, SIZE), Image.LANCZOS)
    vignette = Image.new("L", (SIZE, SIZE), 0); d = ImageDraw.Draw(vignette)
    for i in range(40):
        t = i / 40
        r = SIZE * 0.75 * (1 - t)
        d.ellipse((SIZE / 2 - r, SIZE / 2 - r, SIZE / 2 + r, SIZE / 2 + r), fill=int(110 + 120 * t))
    vignette = vignette.filter(ImageFilter.GaussianBlur(40))
    st.putalpha(ImageChops.multiply(st.split()[3], vignette))
    bg = Image.new("RGBA", (SIZE, SIZE), NAVY + (255,))
    if tint:
        bg = Image.blend(bg, Image.new("RGBA", (SIZE, SIZE), tint + (255,)), 0.45)
    bg.alpha_composite(st)
    return bg

def dust_cluster(bg, n=14, seed=23):
    """A small cloud of dust straight above the centre, at half the visible radius (the gap
    between the cyan's top and the red's antenna): 70 % red, 30 % cyan. Drawn on the
    background, so dots that meet an invader go behind it."""
    R = SIZE * 72 / 108 / 2
    cx, cy, spread = SIZE / 2, SIZE / 2 - R / 2, R * 0.16
    rnd = random.Random(seed); bg = bg.copy()
    for i in range(n):
        x, y = rnd.gauss(cx, spread), rnd.gauss(cy, spread * 0.8)
        sz = rnd.choice([6, 8, 8, 10, 12, 14])
        blur = rnd.choice([0, 0, 1.5, 3])
        col = V.COL["red" if i < round(n * 0.7) else "cyan"] + (int(rnd.uniform(150, 235) * DUST["alpha"]),)
        pad = int(blur * 3) + 2
        dot = Image.new("RGBA", (sz + 2 * pad, sz + 2 * pad))
        ImageDraw.Draw(dot).rectangle((pad, pad, pad + sz - 1, pad + sz - 1), fill=col)
        bg.alpha_composite(dot.filter(ImageFilter.GaussianBlur(blur)) if blur else dot, (int(x) - pad, int(y) - pad))
    return bg

def edge_fade(bg, band=0.2):
    """Fade `bg` to navy over the outer `band` of the radius a round launcher shows
    (72/108 of the layer), so the streets melt into the icon's edge."""
    m = radial_fade(SIZE, SIZE * 72 / 108 / 2, band)
    return Image.composite(Image.new("RGBA", (SIZE, SIZE), NAVY + (255,)), bg, m)

# ── Labels for dev / staging builds ─────────────────────────────────────────────
VARIANTS = {"dev": ((206, 26, 40), "DEV"), "stag": ((32, 96, 210), "STAG")}

def label(im, text, height_frac, y_frac):
    im = im.copy(); d = ImageDraw.Draw(im)
    font = ImageFont.truetype(str(FONT), int(SIZE * height_frac))
    bb = d.textbbox((0, 0), text, font=font)
    x = (SIZE - (bb[2] - bb[0])) // 2 - bb[0]
    y = int(SIZE * y_frac) - bb[1]
    o = max(3, int(SIZE * height_frac / 10))
    for dx in range(-o, o + 1, 2):
        for dy in range(-o, o + 1, 2):
            d.text((x + dx, y + dy), text, font=font, fill=NAVY + (255,))
    d.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    return im

# ── Silhouettes: sprites only (no halo), pupils + eye outlines punched out, a gap where they overlap
# (punching the whole eye out reads as a skull). Eye outlines are as thick as the gaps,
# and so is the line drawn where a two-tone invader (gold, cyan) changes tone.
SHADES = {(212, 159, 0), (15, 168, 184)}  # the darker tone of gold / cyan

def punched(sp, gap):
    """Alpha of sprite `sp` minus its pupils, eye outlines and tone line (`gap` = filter size)."""
    eyes, pupils, shade, body = (Image.new("L", sp.size, 0) for _ in range(4))
    px, ep, pp, sh, bo = sp.load(), eyes.load(), pupils.load(), shade.load(), body.load()
    for yy in range(sp.height):
        for xx in range(sp.width):
            r, g, b, al = px[xx, yy]
            if not al: continue
            if (r, g, b) in ((255, 255, 255), NAVY): ep[xx, yy] = 255
            if (r, g, b) == NAVY: pp[xx, yy] = 255
            elif (r, g, b) in SHADES: sh[xx, yy] = 255
            elif (r, g, b) != (255, 255, 255): bo[xx, yy] = 255
    outline = ImageChops.subtract(eyes, eyes.filter(ImageFilter.MinFilter(gap)))
    tone_line = ImageChops.multiply(shade, body.filter(ImageFilter.MaxFilter(gap)))
    return ImageChops.subtract(sp.split()[3], ImageChops.lighter(ImageChops.lighter(outline, pupils), tone_line))

def silhouette(scale_to, art=ART, places=PLACES):
    """White silhouettes laid out like `art`, resized by the same factor as `scale_to`."""
    canvas = Image.new("L", art.size, 0)
    gap = max(3, int(C.S * 1.5)) | 1
    for _, sp, x, y in places:
        a = sp.split()[3]
        mask = punched(sp, gap)
        hole = Image.new("L", canvas.size, 0); hole.paste(a.filter(ImageFilter.MaxFilter(gap)), (x, y))
        canvas = ImageChops.subtract(canvas, hole)
        layer = Image.new("L", canvas.size, 0); layer.paste(mask, (x, y))
        canvas = ImageChops.lighter(canvas, layer)
    k = scale_to.width / art.width
    canvas = canvas.resize((round(canvas.width * k), round(canvas.height * k)), Image.LANCZOS).point(lambda v: 255 if v > 127 else 0)
    out = Image.new("RGBA", canvas.size, (255, 255, 255, 0)); out.putalpha(canvas)
    return out

def cyan_silhouette(cell, fill=0.99):
    """The cyan invader, untilted, punched like the themed icon, `cell` px per pixel-art
    cell, on a square canvas it fills to `fill` (status-bar icons are tiny: use it all).
    Expo resizes this to every density anyway, so the canvas size is free. Lines are 1 px."""
    sp = C.sprite(C.CYAN_RECTS, s=1)
    sp = sp.resize((sp.width // 10, sp.height // 10), Image.NEAREST)  # one pixel per cell
    a = punched(sp.resize((sp.width * cell, sp.height * cell), Image.NEAREST), 3)
    size = round(max(a.size) / fill)
    out = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    layer = Image.new("RGBA", a.size, (255, 255, 255, 255)); layer.putalpha(a)
    out.alpha_composite(layer, ((size - a.width) // 2, (size - a.height) // 2))
    return out

# ── Build ───────────────────────────────────────────────────────────────────────
def save(im, name, rgb=False):
    (im.convert("RGB") if rgb else im).save(DST / name, optimize=True)
    print("wrote", name, im.size)

bg = background()
icon_art = fit(ART, SIZE * 0.96, SIZE * 0.80, CORE)
icon = bg.copy(); icon.alpha_composite(centered(icon_art))
save(icon, "icon.png", rgb=True)

# Adaptive icon: the launcher masks a 1024 layer down to the central ~66 % circle.
fg_art = fit(ART, SIZE * 0.60, SIZE * 0.40, CORE)           # dev / staging (room for the label)
prod_fg_art = fit(ADAPTIVE[0], SIZE * 0.64, SIZE * 0.46, ADAPTIVE[2])
fg = centered(prod_fg_art)
save(fg, "android-icon-foreground.png")
save(dust_cluster(edge_fade(bg)), "android-icon-background.png", rgb=True)
save(centered(silhouette(prod_fg_art, *ADAPTIVE[:2])), "android-icon-monochrome.png")

for key, (tint, text) in VARIANTS.items():
    tinted = background(tint)
    variant_icon = tinted.copy(); variant_icon.alpha_composite(centered(icon_art, dy=-int(SIZE * 0.06)))
    save(label(variant_icon, text, 0.13, 0.76), f"icon-{key}.png", rgb=True)
    save(label(centered(fg_art, dy=-int(SIZE * 0.05)), text, 0.07, 0.60), f"android-icon-foreground-{key}.png")
    save(tinted, f"android-icon-background-{key}.png", rgb=True)

# Splash: the full logo over the street grid, faded at the edge. Android 12+ crops it to a circle.
save(centered(fit(FULL_LOGO, SIZE, SIZE)), "splash-icon.png")
save(cyan_silhouette(9), "notification-icon.png")
Image.open(HERE / "out/favicon-48.png").save(DST / "favicon.png"); print("wrote favicon.png")

# ── Contact sheet ───────────────────────────────────────────────────────────────
def circle(im, k=72 / 108):
    """What a round launcher shows of an adaptive icon: the central 72/108, masked to a circle."""
    c = (1 - k) / 2 * im.width
    im = im.crop((round(c), round(c), round(im.width - c), round(im.width - c)))
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).ellipse((0, 0, im.width - 1, im.height - 1), fill=255)
    out = Image.new("RGBA", im.size); out.paste(im, mask=m); return out

T = 300
tiles = [
    ("icon", Image.open(DST / "icon.png")),
    ("adaptive", circle(Image.alpha_composite(Image.open(DST / "android-icon-background.png").convert("RGBA"), fg))),
    ("dev", Image.open(DST / "icon-dev.png")),
    ("stag", Image.open(DST / "icon-stag.png")),
    ("adaptive dev", circle(Image.alpha_composite(Image.open(DST / "android-icon-background-dev.png").convert("RGBA"), Image.open(DST / "android-icon-foreground-dev.png")))),
    ("monochrome", circle(Image.alpha_composite(Image.new("RGBA", (SIZE, SIZE), (60, 70, 90, 255)), Image.open(DST / "android-icon-monochrome.png")))),
    ("splash", Image.alpha_composite(Image.new("RGBA", (SIZE, SIZE), NAVY + (255,)), Image.open(DST / "splash-icon.png"))),
    ("notification", (lambda n: Image.alpha_composite(Image.new("RGBA", n.size, (60, 70, 90, 255)), n))(Image.open(DST / "notification-icon.png")).resize((SIZE, SIZE), Image.NEAREST)),
]
sheet = Image.new("RGB", (4 * (T + 20) + 20, 2 * (T + 40) + 20), "#555555"); dd = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(tiles):
    x, y = 20 + (i % 4) * (T + 20), 30 + (i // 4) * (T + 40)
    sheet.paste(im.convert("RGBA").resize((T, T), Image.LANCZOS), (x, y), im.convert("RGBA").resize((T, T), Image.LANCZOS))
    dd.text((x, y - 16), name, fill="white")
sheet.save(HERE / "out/app-icons-preview.png")
print("ok")

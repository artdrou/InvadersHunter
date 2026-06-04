"""
Generate golden "highlighted" marker variants used when an invader is selected
for a multi-stop itinerary.

Each point tier (10/20/30/40/50/100) has its own invader silhouette, so we can't
just reuse the 100pts gold sprite. Instead we take the red/pink *uncaptured*
marker of every tier and hue-shift it to match the gold of marker-100pts-rarity,
preserving the silhouette, shading and glow.

Run: backend/venv/Scripts/python.exe frontend/scripts/gen-highlight-markers.py
"""
import os
import colorsys
from PIL import Image

TIERS = [10, 20, 30, 40, 50, 100]
HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "..", "assets", "images")


def gold_hue_from_reference():
    """Average hue of the saturated, bright gold pixels in the 100pts rarity marker."""
    ref = Image.open(os.path.join(IMG_DIR, "marker-100pts-rarity.png")).convert("RGBA")
    hues = []
    for r, g, b, a in ref.getdata():
        if a < 200:
            continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s > 0.5 and v > 0.5:  # only strongly-coloured gold body pixels
            hues.append(h)
    if not hues:
        return 48.9 / 360  # fallback: #ffd000
    return sum(hues) / len(hues)


def hue_shift(src_path, dst_path, target_h):
    img = Image.open(src_path).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < 0.12:  # near-grey/white/black (outline, highlights) → leave as-is
                continue
            nr, ng, nb = colorsys.hsv_to_rgb(target_h, s, v)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    img.save(dst_path)


def main():
    target_h = gold_hue_from_reference()
    print(f"gold hue = {target_h * 360:.1f} deg")
    for pts in TIERS:
        src = os.path.join(IMG_DIR, f"marker-{pts}pts-flash-uncaptured.png")
        dst = os.path.join(IMG_DIR, f"marker-{pts}pts-highlight.png")
        hue_shift(src, dst, target_h)
        print(f"wrote {os.path.basename(dst)}")


if __name__ == "__main__":
    main()

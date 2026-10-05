"""
Generate hue-shifted marker variants from the red/pink *uncaptured* sprites:

- highlight (gold)  — invader picked for a multi-stop itinerary
- flash-mine (green)   — shared map: only I flashed it
- flash-friend (orange) — shared map: only my friend flashed it

Each point tier (10/20/30/40/50/100) has its own invader silhouette, so every
tier is shifted separately, preserving the silhouette, shading and glow.

Run: backend/venv/Scripts/python.exe frontend/scripts/gen-marker-variants.py
"""
import os
import colorsys
from PIL import Image

TIERS = [10, 20, 30, 40, 50, 100]
HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "..", "assets", "images")

# Keep in sync with FriendMarkerColor in src/features/friends/constants.ts (legend).
GREEN_HUE = 135 / 360
ORANGE_HUE = 28 / 360


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
    gold = gold_hue_from_reference()
    print(f"gold hue = {gold * 360:.1f} deg")
    variants = {"highlight": gold, "flash-mine": GREEN_HUE, "flash-friend": ORANGE_HUE}
    for pts in TIERS:
        src = os.path.join(IMG_DIR, f"marker-{pts}pts-flash-uncaptured.png")
        for suffix, hue in variants.items():
            dst = os.path.join(IMG_DIR, f"marker-{pts}pts-{suffix}.png")
            hue_shift(src, dst, hue)
            print(f"wrote {os.path.basename(dst)}")


if __name__ == "__main__":
    main()

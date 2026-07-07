"""
Generate the per-environment app-icon variants from the base icon.

The build profile is selected at build time via the APP_VARIANT env var (see
app.config.js). Each non-production variant gets a colour wash + a centered
pixel label so the apps are instantly distinguishable side-by-side on-device:

  - production  -> InvaderHunterIcon.png       (base, untouched)
  - development -> InvaderHunterIcon-dev.png    (red wash + "DEV")
  - staging     -> InvaderHunterIcon-stag.png   (blue wash + "STAG")

Run: backend/venv/Scripts/python.exe frontend/scripts/gen-variant-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "..", "assets", "images")
FONT_PATH = os.path.join(HERE, "..", "assets", "fonts", "dogica", "TTF", "dogicapixelbold.ttf")
BASE = os.path.join(IMG_DIR, "InvaderHunterIcon.png")

# variant -> (output filename, wash RGB, wash alpha, label)
VARIANTS = {
    "dev": ("InvaderHunterIcon-dev.png", (206, 26, 40), 0.42, "DEV"),
    "stag": ("InvaderHunterIcon-stag.png", (32, 96, 210), 0.40, "STAG"),
}

LABEL_SIZE_FRAC = 0.16   # label height relative to icon height
LABEL_Y_FRAC = 0.72      # label baseline position (centre-bottom)


def wash(img, color, alpha):
    """Uniform colour wash over the whole icon, keeping the artwork readable."""
    solid = Image.new("RGBA", img.size, color + (255,))
    return Image.blend(img.convert("RGBA"), solid, alpha)


def center_label(img, text):
    img = img.copy()
    W, H = img.size
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, int(H * LABEL_SIZE_FRAC))
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx = (W - tw) // 2 - bb[0]
    ty = int(H * LABEL_Y_FRAC) - bb[1]
    # heavy dark outline so the white text stays legible over the artwork
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            if dx or dy:
                d.text((tx + dx, ty + dy), text, font=font, fill=(0, 0, 0, 235))
    d.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))
    return img


def main():
    base = Image.open(BASE).convert("RGBA")
    for key, (fname, color, alpha, label) in VARIANTS.items():
        out = center_label(wash(base, color, alpha), label)
        dst = os.path.join(IMG_DIR, fname)
        out.convert("RGB").save(dst)
        print(f"wrote {fname}  ({label}, wash {color}@{alpha})")


if __name__ == "__main__":
    main()

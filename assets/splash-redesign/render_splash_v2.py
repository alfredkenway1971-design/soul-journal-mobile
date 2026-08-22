#!/usr/bin/env python3
"""Soul Journal splash v2 — follows Amer's chosen cover (peach->mint gradient,
vertical centered leaf, stacked serif title). Elevated to app-grade craft.
"""
import math
from PIL import Image, ImageDraw, ImageFont

SS = 2
W = H = 1600
SW = W * SS

# ---------- palette ----------
BG_TOP    = (252, 232, 223)   # soft peach/coral
BG_BOTTOM = (220, 241, 232)   # gentle mint
LEAF_TOP  = (52, 211, 153)    # emerald light #34D399
LEAF_BASE = (5, 150, 105)     # emerald #059669
LEAF_EDGE = (4, 120, 87)      # deep emerald outline/veins
TITLE     = (6, 95, 70)       # deep emerald #065F46
SUBTITLE  = (5, 150, 105)

FONT_DIR = "/root/.hermes/fonts"
SERIF = f"{FONT_DIR}/CormorantGaramond.ttf"
SANS  = f"{FONT_DIR}/Inter.ttf"

img = Image.new("RGB", (SW, SW), BG_TOP)

# ---------- background gradient: peach -> mint ----------
d = ImageDraw.Draw(img)
for y in range(SW):
    t = y / (SW - 1)
    r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
    g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
    b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
    d.line([(0, y), (SW, y)], fill=(r, g, b))
img = img.convert("RGBA")
d = ImageDraw.Draw(img, "RGBA")

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

# ---------- vertical leaf geometry ----------
CX = 800 * SS
TIP_Y = 240 * SS          # leaf tip (top)
BASE_Y = 585 * SS         # leaf base (bottom of blade)
LEN = BASE_Y - TIP_Y
WMAX = 82 * SS            # max half-width
BEND = 26 * SS            # gentle S-curve of the midrib

def axis(t):
    x = CX + BEND * math.sin(math.pi * t)
    y = TIP_Y + t * LEN
    return x, y

N = 90
left, right = [], []
for i in range(N + 1):
    t = i / N
    x, y = axis(t)
    w = WMAX * (math.sin(math.pi * t) ** 0.92)
    left.append((x - w, y))
    right.append((x + w, y))

# leaf fill with lengthwise gradient
for i in range(N):
    t0, t1 = i / N, (i + 1) / N
    pts = [left[i], left[i + 1], right[i + 1], right[i]]
    d.polygon(pts, fill=lerp(LEAF_BASE, LEAF_TOP, (t0 + t1) / 2) + (255,))

# subtle edge: hairline outline along both sides
edge = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
ed = ImageDraw.Draw(edge)
edge_pts = [axis(i / N) for i in range(N + 1)]
for i in range(N):
    t = (i + 0.5) / N
    w = WMAX * (math.sin(math.pi * t) ** 0.92)
    x, y = axis(t)
    ed.line([left[i], left[i + 1]], fill=LEAF_EDGE + (70,), width=SS + 1)
    ed.line([right[i], right[i + 1]], fill=LEAF_EDGE + (70,), width=SS + 1)
img = Image.alpha_composite(img, edge)
d = ImageDraw.Draw(img, "RGBA")

# ---------- midrib + side veins (deep emerald hairlines) ----------
vein = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
vd = ImageDraw.Draw(vein)
mid = [axis(i / (N * 2)) for i in range(N * 2 + 1)]
for i in range(len(mid) - 1):
    vd.line([mid[i], mid[i + 1]], fill=LEAF_EDGE + (150,), width=SS + 1)
for t in (0.22, 0.36, 0.50, 0.64):
    x, y = axis(t)
    half = WMAX * (math.sin(math.pi * t) ** 0.92)
    for sgn in (-1, 1):
        x2 = x + half * 0.66 * sgn
        y2 = y + 6 * SS * sgn * math.sin(math.pi * t)
        vd.line([(x, y), (x2, y2)], fill=LEAF_EDGE + (110,), width=SS)
img = Image.alpha_composite(img, vein)
d = ImageDraw.Draw(img, "RGBA")

# ---------- stem (downward, slight curve) ----------
stem = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
sd = ImageDraw.Draw(stem)
for k in range(31):
    t = k / 30
    x = CX + 14 * SS * (t ** 1.6)
    y = BASE_Y + 46 * SS * t
    sd.ellipse([x - 3.4 * SS, y - 3.4 * SS, x + 3.4 * SS, y + 3.4 * SS],
               fill=LEAF_EDGE + (230,))
img = Image.alpha_composite(img, stem)
d = ImageDraw.Draw(img, "RGBA")

# ---------- typography ----------
def tracked_text(draw, xy_center, text, font, fill, tracking):
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = xy_center[0] - total / 2
    y = xy_center[1]
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking

f_title = ImageFont.truetype(SERIF, 158 * SS)
tracked_text(d, (CX, 780 * SS), "Soul", f_title, TITLE, 4 * SS)
tracked_text(d, (CX, 780 * SS + 172 * SS), "Journal", f_title, TITLE, 4 * SS)

f_sub = ImageFont.truetype(SANS, 40 * SS)
sub = "Mindfulness and Peace"
tracked_text(d, (CX, 1170 * SS), sub, f_sub, SUBTITLE + (215,), 3 * SS)

# ---------- downsample ----------
out = img.resize((W, H), Image.LANCZOS).convert("RGB")
OUT = "/root/soul-journal-mobile/assets/splash-redesign/splash-1600-v2.png"
out.save(OUT, "PNG")
print("saved", OUT, out.size)

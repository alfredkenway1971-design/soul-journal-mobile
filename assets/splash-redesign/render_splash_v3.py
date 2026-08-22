#!/usr/bin/env python3
"""Soul Journal splash v3 — faithful rebuild of Amer's chosen cover.
Outlined sage leaf, bold Playfair serif, deep-green subtitle, peach->aqua gradient.
"""
import math
from PIL import Image, ImageDraw, ImageFont

SS = 2
W = H = 1600
SW = W * SS

# ---------- palette (from the reference cover) ----------
BG_TOP    = (250, 220, 208)   # soft pastel peach / light coral
BG_BOTTOM = (214, 236, 228)   # gentle mint / pale aqua
LEAF_TOP  = (172, 199, 174)   # sage light
LEAF_BASE = (143, 181, 150)   # sage mid
LEAF_EDGE = (53, 107, 78)     # dark muted green (outline/veins)
TITLE     = (47, 93, 70)      # dark muted green #2F5D46
SUBTITLE  = (62, 107, 82)     # dark green #3E6B52

FONT_DIR = "/root/.hermes/fonts"
SERIF = f"{FONT_DIR}/PlayfairDisplay.ttf"
SANS  = f"{FONT_DIR}/Inter.ttf"

img = Image.new("RGB", (SW, SW), BG_TOP)
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

# ---------- broad vertical leaf ----------
CX = 800 * SS
TIP_Y = 300 * SS
BASE_Y = 765 * SS
LEN = BASE_Y - TIP_Y
WMAX = 210 * SS            # half-width -> ~420px broad leaf (honors ref's ~1/3 width)
BEND = 30 * SS

def axis(t):
    return CX + BEND * math.sin(math.pi * t), TIP_Y + t * LEN

N = 110
left, right = [], []
for i in range(N + 1):
    t = i / N
    x, y = axis(t)
    w = WMAX * (math.sin(math.pi * t) ** 0.85)
    left.append((x - w, y))
    right.append((x + w, y))

# fill with subtle vertical gradient
for i in range(N):
    t0, t1 = i / N, (i + 1) / N
    pts = [left[i], left[i + 1], right[i + 1], right[i]]
    d.polygon(pts, fill=lerp(LEAF_TOP, LEAF_BASE, (t0 + t1) / 2) + (255,))

# thin dark outline around the blade
edge = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
ed = ImageDraw.Draw(edge)
for i in range(N):
    ed.line([left[i], left[i + 1]], fill=LEAF_EDGE + (215,), width=SS + 2)
    ed.line([right[i], right[i + 1]], fill=LEAF_EDGE + (215,), width=SS + 2)
img = Image.alpha_composite(img, edge)
d = ImageDraw.Draw(img, "RGBA")

# midrib + side veins (fine dark lines)
vein = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
vd = ImageDraw.Draw(vein)
mid = [axis(i / (N * 2)) for i in range(N * 2 + 1)]
for i in range(len(mid) - 1):
    vd.line([mid[i], mid[i + 1]], fill=LEAF_EDGE + (185,), width=SS + 1)
for t in (0.16, 0.30, 0.44, 0.58, 0.72):
    x, y = axis(t)
    half = WMAX * (math.sin(math.pi * t) ** 0.85)
    for sgn in (-1, 1):
        x2 = x + half * 0.62 * sgn
        y2 = y + 5 * SS * sgn * math.sin(math.pi * t)
        vd.line([(x, y), (x2, y2)], fill=LEAF_EDGE + (150,), width=SS + 1)
img = Image.alpha_composite(img, vein)
d = ImageDraw.Draw(img, "RGBA")

# stem: thin, curved, downward
stem = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
sd = ImageDraw.Draw(stem)
for k in range(31):
    t = k / 30
    x = CX + 12 * SS * (t ** 1.7) + 6 * SS * math.sin(math.pi * t)
    y = BASE_Y + 55 * SS * t
    sd.ellipse([x - 2.6 * SS, y - 2.6 * SS, x + 2.6 * SS, y + 2.6 * SS],
               fill=LEAF_EDGE + (235,))
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

f_title = ImageFont.truetype(SERIF, 172 * SS)
f_title.set_variation_by_axes([700])
tracked_text(d, (CX, 995 * SS), "Soul", f_title, TITLE, 6 * SS)
tracked_text(d, (CX, 995 * SS + 185 * SS), "Journal", f_title, TITLE, 6 * SS)

f_sub = ImageFont.truetype(SANS, 44 * SS)
sub = "Mindfulness and Peace"
tracked_text(d, (CX, 1362 * SS), sub, f_sub, SUBTITLE, 4 * SS)

# ---------- downsample ----------
out = img.resize((W, H), Image.LANCZOS).convert("RGB")
OUT = "/root/soul-journal-mobile/assets/splash-redesign/splash-1600-v3.png"
out.save(OUT, "PNG")
print("saved", OUT, out.size)

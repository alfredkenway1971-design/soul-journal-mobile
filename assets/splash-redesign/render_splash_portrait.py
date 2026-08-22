#!/usr/bin/env python3
"""Soul Journal splash — portrait full-bleed variant (1242x2688) of the v3 design."""
import math
from PIL import Image, ImageDraw, ImageFont

SS = 2
W, H = 1242, 2688        # final portrait canvas (iPhone @3x-ish)
k = W / 1600.0           # scale from the 1600-square master
SW, SH = W * SS, H * SS

# palette (same as v3)
BG_TOP    = (250, 220, 208)
BG_BOTTOM = (214, 236, 228)
LEAF_TOP  = (172, 199, 174)
LEAF_BASE = (143, 181, 150)
LEAF_EDGE = (53, 107, 78)
TITLE     = (47, 93, 70)
SUBTITLE  = (62, 107, 82)

FONT_DIR = "/root/.hermes/fonts"
SERIF = f"{FONT_DIR}/PlayfairDisplay.ttf"
SANS  = f"{FONT_DIR}/Inter.ttf"

# content block in master coords: y 300 -> 1402 ; center it slightly above middle
CONTENT_TOP, CONTENT_BOT = 300.0, 1405.0
content_h = (CONTENT_BOT - CONTENT_TOP) * k
off = (H - content_h) * 0.42 * SS

def Y(y):  # master y -> canvas y
    return (y * k) * SS + off

def X(x):  # master x -> canvas x (centered)
    return (x - 800.0) * k * SS + W * SS / 2

img = Image.new("RGB", (SW, SH), BG_TOP)
d = ImageDraw.Draw(img)
for y in range(SH):
    t = y / (SH - 1)
    r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
    g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
    b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
    d.line([(0, y), (SW, y)], fill=(r, g, b))
img = img.convert("RGBA")
d = ImageDraw.Draw(img, "RGBA")

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

# ---------- leaf (master coords) ----------
CX, TIP_Y, BASE_Y = 800.0, 300.0, 765.0
LEN = BASE_Y - TIP_Y
WMAX = 210.0
BEND = 30.0

def axis(t):
    return CX + BEND * math.sin(math.pi * t), TIP_Y + t * LEN

N = 110
left, right = [], []
for i in range(N + 1):
    t = i / N
    mx, my = axis(t)
    w = WMAX * (math.sin(math.pi * t) ** 0.85) * k * SS
    left.append((X(mx), Y(my) - w))
    right.append((X(mx), Y(my) + w))

for i in range(N):
    t0, t1 = i / N, (i + 1) / N
    pts = [left[i], left[i + 1], right[i + 1], right[i]]
    d.polygon(pts, fill=lerp(LEAF_TOP, LEAF_BASE, (t0 + t1) / 2) + (255,))

lw = max(SS + 2, round((SS + 2) * k))
edge = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
ed = ImageDraw.Draw(edge)
for i in range(N):
    ed.line([left[i], left[i + 1]], fill=LEAF_EDGE + (215,), width=lw)
    ed.line([right[i], right[i + 1]], fill=LEAF_EDGE + (215,), width=lw)
img = Image.alpha_composite(img, edge)
d = ImageDraw.Draw(img, "RGBA")

vein = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
vd = ImageDraw.Draw(vein)
mid = [axis(i / (N * 2)) for i in range(N * 2 + 1)]
vmid = [ (X(mx), Y(my)) for mx, my in mid ]
for i in range(len(vmid) - 1):
    vd.line([vmid[i], vmid[i + 1]], fill=LEAF_EDGE + (185,), width=max(SS + 1, round((SS + 1) * k)))
for t in (0.16, 0.30, 0.44, 0.58, 0.72):
    mx, my = axis(t)
    half = WMAX * (math.sin(math.pi * t) ** 0.85) * k * SS
    px, py = X(mx), Y(my)
    for sgn in (-1, 1):
        x2 = px + half * 0.62 * sgn
        y2 = py + 5 * k * SS * sgn * math.sin(math.pi * t)
        vd.line([(px, py), (x2, y2)], fill=LEAF_EDGE + (150,), width=max(SS + 1, round((SS + 1) * k)))
img = Image.alpha_composite(img, vein)
d = ImageDraw.Draw(img, "RGBA")

stem = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
sd = ImageDraw.Draw(stem)
r0 = 2.6 * k * SS
for tt in range(31):
    t = tt / 30
    mx = CX + 12.0 * (t ** 1.7) + 6.0 * math.sin(math.pi * t)
    my = BASE_Y + 55.0 * t
    x, y = X(mx), Y(my)
    sd.ellipse([x - r0, y - r0, x + r0, y + r0], fill=LEAF_EDGE + (235,))
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

f_title = ImageFont.truetype(SERIF, round(172 * k * SS))
f_title.set_variation_by_axes([700])
tracked_text(d, (W * SS / 2, Y(995)), "Soul", f_title, TITLE, 6 * k * SS)
tracked_text(d, (W * SS / 2, Y(995 + 185)), "Journal", f_title, TITLE, 6 * k * SS)

f_sub = ImageFont.truetype(SANS, round(44 * k * SS))
tracked_text(d, (W * SS / 2, Y(1362)), "Mindfulness and Peace", f_sub, SUBTITLE, 4 * k * SS)

out = img.resize((W, H), Image.LANCZOS).convert("RGB")
OUT = "/root/soul-journal-mobile/assets/splash-redesign/splash-portrait.png"
out.save(OUT, "PNG")
print("saved", OUT, out.size)

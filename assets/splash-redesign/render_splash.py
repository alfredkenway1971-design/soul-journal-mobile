#!/usr/bin/env python3
"""Soul Journal splash redesign — "Quiet Stillness".
Renders at 2x supersampling, downscales to 1600x1600 for crisp edges.
"""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 2          # supersample factor
W = H = 1600    # final canvas
SW = W * SS     # supersampled size

# ---------- palette (light-only, emerald family) ----------
BG_TOP    = (253, 254, 252)   # near-white
BG_BOTTOM = (235, 247, 240)   # whisper mint
LEAF_BASE = (5, 150, 105)     # emerald #059669
LEAF_TIP  = (16, 185, 129)    # emerald light #10B981
TITLE     = (6, 95, 70)       # deep emerald #065F46
SUBTITLE  = (5, 150, 105)
RING      = (5, 150, 105)

FONT_DIR = "/root/.hermes/fonts"
SERIF = f"{FONT_DIR}/CormorantGaramond.ttf"
SANS  = f"{FONT_DIR}/Inter.ttf"

img = Image.new("RGB", (SW, SW), BG_TOP)
d = ImageDraw.Draw(img, "RGBA")

# ---------- background: soft vertical gradient ----------
for y in range(SW):
    t = y / (SW - 1)
    r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
    g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
    b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
    d.line([(0, y), (SW, y)], fill=(r, g, b))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

# ---------- geometry (supersampled coordinates) ----------
CX, CY = 800 * SS, 500 * SS          # ring centre
RR = 190 * SS                        # ring radius
# leaf axis: stem base -> tip (pointing up-left, slight S-bend)
A = (CX + 95 * SS, CY + 105 * SS)    # base (stem end)
B = (CX - 78 * SS, CY - 88 * SS)     # tip
BEND = 17 * SS
LEN = math.hypot(B[0] - A[0], B[1] - A[1])
NX, NY = (B[1] - A[1]) / LEN, -(B[0] - A[0]) / LEN   # unit normal
WMAX = 56 * SS                       # max half-width

def axis(t):
    x = A[0] + t * (B[0] - A[0]) + BEND * math.sin(math.pi * t)
    y = A[1] + t * (B[1] - A[1])
    return x, y

def leaf_color(t):
    return lerp(LEAF_BASE, LEAF_TIP, t ** 0.85)

N = 90
left, right = [], []
for i in range(N + 1):
    t = i / N
    x, y = axis(t)
    w = WMAX * (math.sin(math.pi * t) ** 0.9)
    left.append((x + NX * w, y + NY * w))
    right.append((x - NX * w, y - NY * w))

# ---------- leaf fill (per-strip gradient along the axis) ----------
poly = left + right[::-1]
# draw per-segment strips for a gradient along the axis
for i in range(N):
    t0, t1 = i / N, (i + 1) / N
    pts = [left[i], left[i + 1], right[i + 1], right[i]]
    d.polygon(pts, fill=leaf_color((t0 + t1) / 2) + (255,))

# ---------- midrib + side veins (subtle light lines) ----------
vein = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
vd = ImageDraw.Draw(vein)
mid = [axis(i / (N * 2)) for i in range(N * 2 + 1)]
for p in mid:
    vd.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=(255, 255, 255, 95))
# side veins
for t in (0.24, 0.38, 0.52, 0.66):
    x, y = axis(t)
    half = WMAX * (math.sin(math.pi * t) ** 0.9)
    # two short hairlines toward each edge
    for sgn in (-1, 1):
        x2 = x + NX * half * 0.62 * sgn
        y2 = y + NY * half * 0.62 * sgn
        vd.line([(x, y), (x2, y2)], fill=(255, 255, 255, 60), width=max(2, SS))
img = Image.alpha_composite(img.convert("RGBA"), vein)
d = ImageDraw.Draw(img, "RGBA")

# ---------- stem ----------
stem = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
sd = ImageDraw.Draw(stem)
sx0, sy0 = A
sx1, sy1 = A[0] + 22 * SS, A[1] + 26 * SS
for k in range(31):
    t = k / 30
    x = sx0 + (sx1 - sx0) * t + 8 * SS * math.sin(math.pi * t)
    y = sy0 + (sy1 - sy0) * t
    sd.ellipse([x - 4 * SS, y - 4 * SS, x + 4 * SS, y + 4 * SS], fill=(4, 120, 87, 255))
img = Image.alpha_composite(img, stem)
d = ImageDraw.Draw(img, "RGBA")

# ---------- hairline rings ----------
ring = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
rd = ImageDraw.Draw(ring)
rd.ellipse([CX - RR, CY - RR, CX + RR, CY + RR], outline=RING + (58,), width=3 * SS)
rd.ellipse([CX - RR - 16 * SS, CY - RR - 16 * SS, CX + RR + 16 * SS, CY + RR + 16 * SS],
           outline=RING + (26,), width=SS + 1)
img = Image.alpha_composite(img, ring)
d = ImageDraw.Draw(img, "RGBA")

# ---------- title: stacked serif with gentle tracking ----------
def tracked_text(draw, xy_center, text, font, fill, tracking):
    """Draw text centered at x, each glyph shifted by tracking."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = xy_center[0] - total / 2
    y = xy_center[1]
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking

f_title = ImageFont.truetype(SERIF, 148 * SS)
tracked_text(d, (CX, 770 * SS), "Soul", f_title, TITLE, 6 * SS)
tracked_text(d, (CX, 770 * SS + 168 * SS), "Journal", f_title, TITLE, 6 * SS)

# ---------- subtitle: letterspaced caps ----------
f_sub = ImageFont.truetype(SANS, 42 * SS)
sub = "MINDFULNESS & PEACE"
tracked_text(d, (CX, 1166 * SS), sub, f_sub, SUBTITLE + (200,), 10 * SS)

# small diamonds flanking the subtitle
sub_w = d.textlength(sub, font=f_sub) + 10 * SS * (len(sub) - 1)
diam_y = 1166 * SS + 24 * SS
diam_r = 6 * SS
for side in (-1, 1):
    dx = CX + side * (sub_w / 2 + 52 * SS)
    pts = [(dx, diam_y - diam_r), (dx + diam_r, diam_y),
           (dx, diam_y + diam_r), (dx - diam_r, diam_y)]
    d.polygon(pts, fill=SUBTITLE + (200,))

# ---------- supersample down ----------
out = img.resize((W, H), Image.LANCZOS).convert("RGB")
OUT = "/root/soul-journal-mobile/assets/splash-redesign/splash-1600.png"
out.save(OUT, "PNG")
print("saved", OUT, out.size)

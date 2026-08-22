#!/usr/bin/env python3
"""Soul Journal splash v4 — faithful rebuild of cover #3.
Line-art leaf (no fill), peach-cream -> pale blue gradient,
'Soul' set larger than 'Journal', elegant serif + sans subtitle.
Renders square (review) + portrait (app install).
"""
import math
from PIL import Image, ImageDraw, ImageFont

SS = 2
MASTER = 1600.0

# palette
BG_TOP    = (251, 233, 223)   # pastel peach / cream
BG_BOTTOM = (214, 230, 244)   # pale blue
LEAF_INK  = (74, 122, 94)     # muted deep green
TITLE     = (51, 97, 74)      # dark muted green
SUBTITLE  = (74, 122, 94)

FONT_DIR = "/root/.hermes/fonts"
SERIF = f"{FONT_DIR}/CormorantGaramond.ttf"
SANS  = f"{FONT_DIR}/Inter.ttf"

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make_canvas(W, H, k, off_frac=0.42):
    """k = master->canvas scale; returns (img, Y, X) where Y/X map master coords."""
    SW, SH = W * SS, H * SS
    img = Image.new("RGB", (SW, SH), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(SH):
        t = y / (SH - 1)
        d.line([(0, y), (SW, y)], fill=lerp(BG_TOP, BG_BOTTOM, t))
    img = img.convert("RGBA")

    content_h = (1400.0 - 290.0) * k
    off = (H - content_h) * off_frac * SS
    def Y(y): return (y * k) * SS + off
    def X(x): return (x - MASTER / 2) * k * SS + W * SS / 2
    return img, Y, X

def draw_leaf(d, X, Y, k, cx, tip_y, base_y, wmax, bend, ink, alpha):
    LEN = base_y - tip_y
    N = 120
    def axis(t):
        return cx + bend * math.sin(math.pi * t), tip_y + t * LEN

    ptsL, ptsR, axis_pts = [], [], []
    for i in range(N + 1):
        t = i / N
        x, y = axis(t)
        w = wmax * (math.sin(math.pi * t) ** 0.9)
        ptsL.append((X(x) - w * k * SS, Y(y)))
        ptsR.append((X(x) + w * k * SS, Y(y)))
    for i in range(N * 2 + 1):
        t = i / (N * 2)
        x, y = axis(t)
        axis_pts.append((X(x), Y(y)))

    wl = max(3, round(3 * k * SS))          # outline width
    r = wl / 2
    # outline as smooth stroked path
    for i in range(0, N, 2):
        for a, b in [(ptsL[i], ptsL[i + 2]), (ptsR[i], ptsR[i + 2])]:
            d.line([a, b], fill=ink + (alpha,), width=wl)
    for p in ptsL + ptsR:
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=ink + (alpha,))
    # midrib
    wm = max(2, round(2 * k * SS))
    for i in range(0, N * 2, 4):
        a, b = axis_pts[i], axis_pts[i + 4]
        d.line([a, b], fill=ink + (alpha,), width=wm)
    # side veins (from midrib toward edge)
    wv = max(1, round(1.4 * k * SS))
    for t in (0.15, 0.28, 0.41, 0.54, 0.67, 0.79):
        x, y = axis(t)
        half = wmax * (math.sin(math.pi * t) ** 0.9)
        px, py = X(x), Y(y)
        for sgn in (-1, 1):
            x2 = px + half * 0.70 * k * SS * sgn
            y2 = py + 6 * k * SS * sgn * math.sin(math.pi * t)
            d.line([(px, py), (x2, y2)], fill=ink + (alpha,), width=wv)

def add_text(d, X, Y, k, cx, cy, text, font_path, size, fill, tracking, variation=None):
    font = ImageFont.truetype(font_path, round(size * k * SS))
    if variation:
        font.set_variation_by_axes(variation)
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * k * SS * (len(text) - 1)
    x = X(cx) - total / 2
    y = Y(cy)
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + tracking * k * SS

def render(W, H, out, off_frac=0.42):
    k = W / MASTER
    img, Y, X = make_canvas(W, H, k, off_frac)
    d = ImageDraw.Draw(img, "RGBA")
    draw_leaf(d, X, Y, k, cx=MASTER / 2, tip_y=290, base_y=700,
              wmax=115, bend=24, ink=LEAF_INK, alpha=235)
    add_text(d, X, Y, k, MASTER / 2, 950, "Soul", SERIF, 150, TITLE, 6)
    add_text(d, X, Y, k, MASTER / 2, 950 + 148, "Journal", SERIF, 128, TITLE, 6)
    add_text(d, X, Y, k, MASTER / 2, 1280, "Mindfulness and Peace", SANS, 42, SUBTITLE, 4)
    out_img = img.resize((W, H), Image.LANCZOS).convert("RGB")
    out_img.save(out, "PNG")
    print("saved", out, out_img.size)

render(1600, 1600, "/root/soul-journal-mobile/assets/splash-redesign/splash-1600-v4.png")
render(1242, 2688, "/root/soul-journal-mobile/assets/splash-redesign/splash-portrait-v4.png", off_frac=0.40)

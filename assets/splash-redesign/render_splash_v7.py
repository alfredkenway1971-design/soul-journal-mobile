#!/usr/bin/env python3
"""Soul Journal splash v7 — faithful rebuild of img_465c2bbc2afa / img_5d649dc0763a.
Background: soft diagonal wash — warm peach glow top-right (#F9E1B5) melting
into pale blue-mint (#D8EAEA -> #C9E4EF), settling to sage (#C0D5C4).
Leaf: filled translucent sage (#AEBFAD) + dark-green outline (#3A534D),
tilted ~42 deg clockwise (tip up-right, stem down-left), central vein +
curved side veins. Title: 'Soul' serif ~0.14H then 'Journal' LARGER ~0.16H,
both #3A534D, stacked, centered. Subtitle 'Mindfulness and Peace' gray
sans (#50675A). No ornaments.
Renders square (review) + portrait (app install).
"""
import math
from PIL import Image, ImageDraw, ImageFont

SS = 2
MASTER = 1600.0

BG_TOPLEFT  = (216, 234, 234)   # #D8EAEA pale blue-mint
BG_PEACH    = (249, 225, 181)   # #F9E1B5 top-right glow
BG_MID      = (201, 228, 239)   # #C9E4EF light blue
BG_BOTTOM   = (192, 213, 196)   # #C0D5C4 sage
LEAF_INK    = (58, 83, 77)      # #3A534D
LEAF_FILL   = (174, 191, 173)   # #AEBFAD
TITLE       = (58, 83, 77)
SUBTITLE    = (80, 103, 90)     # #50675A

FONT_DIR = "/root/.hermes/fonts"
SERIF = f"{FONT_DIR}/PlayfairDisplay.ttf"
SANS  = f"{FONT_DIR}/Inter.ttf"

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make_canvas(W, H, k, off_frac=0.42):
    SW, SH = W * SS, H * SS
    img = Image.new("RGB", (SW, SH))
    d = ImageDraw.Draw(img)
    for y in range(SH):
        ty = y / (SH - 1)
        for x in range(0, SW, 4):
            tx = x / (SW - 1)
            # vertical: mint -> blue -> sage ; horizontal adds peach on the right-top
            if ty < 0.35:
                base = lerp(BG_TOPLEFT, BG_MID, ty / 0.35)
            else:
                base = lerp(BG_MID, BG_BOTTOM, (ty - 0.35) / 0.65)
            peach_mix = max(0.0, tx - 0.55) / 0.45 * max(0.0, 1 - ty / 0.30)
            c = lerp(base, BG_PEACH, peach_mix * 0.85)
            d.rectangle([x, y, min(x + 4, SW - 1), y], fill=c)
    img = img.convert("RGBA")

    content_h = (1400.0 - 290.0) * k
    off = (H - content_h) * off_frac * SS
    def Y(y): return (y * k) * SS + off
    def X(x): return (x - MASTER / 2) * k * SS + W * SS / 2
    return img, Y, X

def draw_leaf(d, X, Y, k, cx, tip_y, base_y, wmax, bend, ink, fill,
              fill_alpha, tilt=0.0, stem_len=0.0):
    """Tilt rotates the whole leaf about its center; positive = clockwise."""
    LEN = base_y - tip_y
    N = 120
    cy = (tip_y + base_y) / 2.0
    ca, sa = math.cos(tilt), math.sin(tilt)
    def rot(x, y):
        dx, dy = x - cx, y - cy
        return cx + dx * ca - dy * sa, cy + dx * sa + dy * ca
    def axis(t):
        return rot(cx + bend * math.sin(math.pi * t), tip_y + t * LEN)

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

    if fill:
        d.polygon(ptsL + list(reversed(ptsR)), fill=fill + (fill_alpha,))
    wl = max(3, round(3 * k * SS)); r = wl / 2
    for i in range(0, N, 2):
        for a, b in [(ptsL[i], ptsL[i + 2]), (ptsR[i], ptsR[i + 2])]:
            d.line([a, b], fill=ink + (255,), width=wl)
    for p in ptsL + ptsR:
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=ink + (255,))
    wm = max(2, round(2 * k * SS))
    for i in range(0, N * 2, 4):
        d.line([axis_pts[i], axis_pts[i + 4]], fill=ink + (255,), width=wm)
    # side veins curving toward the tip
    wv = max(1, round(1.3 * k * SS))
    for t in (0.18, 0.32, 0.46, 0.60, 0.74):
        x, y = axis(t)
        half = wmax * (math.sin(math.pi * t) ** 0.9)
        px_, py_ = X(x), Y(y)
        pull = 7 * k * SS * (0.5 + t)
        for sgn in (-1, 1):
            d.line([(px_, py_),
                    (px_ + half * 0.36 * k * SS * sgn, py_ - pull * 0.55),
                    (px_ + half * 0.72 * k * SS * sgn, py_ - pull)],
                   fill=ink + (255,), width=wv)
    # stem continues from the base along the tilt direction
    if stem_len > 0:
        bx, by = axis(1.0)
        ex = bx + math.sin(tilt) * stem_len
        ey = by + math.cos(tilt) * stem_len
        d.line([(X(bx), Y(by)), (X(ex), Y(ey))], fill=ink + (255,), width=max(2, round(2.4 * k * SS)))

def add_text(d, X, Y, k, cx, cy, text, font_path, size, fill, tracking,
             variation=None):
    font = ImageFont.truetype(font_path, round(size * k * SS))
    if variation:
        try:
            font.set_variation_by_axes(variation)
        except Exception:
            pass
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
    draw_leaf(d, X, Y, k, cx=MASTER / 2, tip_y=270, base_y=690,
              wmax=104, bend=22, ink=LEAF_INK, fill=LEAF_FILL, fill_alpha=170,
              tilt=math.radians(42), stem_len=70)
    add_text(d, X, Y, k, MASTER / 2, 830, "Soul", SERIF, 132, TITLE, 4,
             variation={"wght": 500})
    add_text(d, X, Y, k, MASTER / 2, 980, "Journal", SERIF, 150, TITLE, 4,
             variation={"wght": 500})
    add_text(d, X, Y, k, MASTER / 2, 1185, "Mindfulness and Peace", SANS, 40, SUBTITLE, 4)
    out_img = img.resize((W, H), Image.LANCZOS).convert("RGB")
    out_img.save(out, "PNG")
    print("saved", out, out_img.size)

render(1600, 1600, "/root/soul-journal-mobile/assets/splash-redesign/splash-1600-v7.png")
render(1242, 2688, "/root/soul-journal-mobile/assets/splash-redesign/splash-portrait-v7.png", off_frac=0.40)

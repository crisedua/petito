"""Compose 1080x1920 vertical story slides with Pillow — theme-designed, not plain photos."""
import math
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

W, H = 1080, 1920
FONT_DIR = Path(__file__).parent / "assets" / "fonts"

INK = (26, 25, 24)

# Per-theme visual identity: gradient (top,bottom), accent, accent2, motif key.
THEME_STYLE = {
    "mi_ano":       {"grad": ((247, 196, 92), (224, 112, 60)), "accent": (224, 90, 71), "accent2": (255, 255, 255), "motif": "confetti"},
    "mis_aventuras":{"grad": ((96, 150, 128), (30, 58, 50)),   "accent": (245, 166, 35), "accent2": (255, 255, 255), "motif": "mountains"},
    "un_dia":       {"grad": ((252, 214, 134), (240, 146, 104)),"accent": (224, 90, 71), "accent2": (255, 255, 255), "motif": "sun"},
    "dieciochero":  {"grad": ((214, 48, 34), (138, 24, 18)),   "accent": (0, 57, 166),  "accent2": (255, 255, 255), "motif": "garland"},
    "navidad":      {"grad": ((22, 112, 72), (9, 56, 38)),      "accent": (213, 43, 30), "accent2": (245, 200, 90), "motif": "snow"},
}
DEFAULT_STYLE = THEME_STYLE["mi_ano"]


def style_for(theme_key):
    return THEME_STYLE.get(theme_key, DEFAULT_STYLE)


# ---------------- fonts ----------------
def _font(file, size, weight=None):
    try:
        f = ImageFont.truetype(str(FONT_DIR / file), size)
        if weight is not None:
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                pass
        return f
    except Exception:
        return ImageFont.truetype("/usr/share/fonts/truetype/freefont/FreeSansBold.ttf", size)


def display_font(size, weight=600):
    return _font("Fredoka-Bold.ttf", size, weight)


def body_font(size, weight=700):
    return _font("Jakarta.ttf", size, weight)


def script_font(size, weight=700):
    return _font("Caveat.ttf", size, weight)


# ---------------- primitives ----------------
def _wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _gradient(top, bottom, h=H, w=W):
    g = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g.resize((w, h))


def _cover(img, w=W, h=H, center=(0.5, 0.42)):
    return ImageOps.fit(img.convert("RGB"), (w, h), Image.LANCZOS, centering=center)


def _rounded(img, radius):
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius=radius, fill=255)
    img.putalpha(mask)
    return img


def _vignette(img, strength=120):
    ov = Image.new("L", (W, H), 0)
    ImageDraw.Draw(ov).ellipse([int(W * 0.04), int(H * 0.03), int(W * 0.96), int(H * 0.97)], fill=255)
    ov = ov.filter(ImageFilter.GaussianBlur(170))
    edge = ImageOps.invert(ov).point(lambda p: int(p * strength / 255))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dark.putalpha(edge)
    base = img.convert("RGBA")
    base.alpha_composite(dark)
    return base.convert("RGB")


def _grain(img, amount=0.05):
    arr = (np.random.rand(H // 3, W // 3) * 255).astype("uint8")
    n = Image.fromarray(arr, "L").resize((W, H)).convert("RGB")
    return Image.blend(img.convert("RGB"), n, amount)


def _paw(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    pr = int(r * 0.42)
    for dx, dy in [(-1.1, -1.25), (-0.1, -1.6), (1.1, -1.25)]:
        draw.ellipse([cx + dx * r - pr, cy + dy * r - pr, cx + dx * r + pr, cy + dy * r + pr], fill=color)


def _star(draw, cx, cy, r, color, rot=0):
    pts = []
    for i in range(10):
        ang = math.pi / 5 * i - math.pi / 2 + math.radians(rot)
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=color)


def _snowflake(draw, cx, cy, r, color):
    for a in range(0, 360, 60):
        rad = math.radians(a)
        x2, y2 = cx + r * math.cos(rad), cy + r * math.sin(rad)
        draw.line([cx, cy, x2, y2], fill=color, width=max(2, r // 8))
        mx, my = cx + r * 0.6 * math.cos(rad), cy + r * 0.6 * math.sin(rad)
        for off in (-35, 35):
            ar = math.radians(a + off)
            draw.line([mx, my, mx + r * 0.3 * math.cos(ar), my + r * 0.3 * math.sin(ar)], fill=color, width=max(2, r // 10))


def _blob(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def apply_motif(img, style, density="full"):
    """Draw theme decorations on an RGBA image."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    motif = style["motif"]
    a = style["accent"]
    a2 = style["accent2"]
    rnd = random.Random(7)

    if motif == "confetti":
        cols = [a + (235,), a2 + (235,), (255, 220, 120, 235)]
        count = 55 if density == "full" else 16
        zone = H if density == "full" else int(H * 0.26)
        for _ in range(count):
            x, y = rnd.randint(0, W), rnd.randint(0, zone)
            s = rnd.randint(8, 22)
            c = rnd.choice(cols)
            if rnd.random() < 0.5:
                d.ellipse([x, y, x + s, y + s], fill=c)
            else:
                tile = Image.new("RGBA", (s, int(s * 0.5)), c)
                layer.alpha_composite(tile.rotate(rnd.randint(0, 180), expand=True), (x, y))
    elif motif == "snow":
        count = 45 if density == "full" else 14
        zone = H if density == "full" else int(H * 0.26)
        for _ in range(count):
            x, y = rnd.randint(0, W), rnd.randint(0, zone)
            _snowflake(d, x, y, rnd.randint(10, 26), (255, 255, 255, 180))
        if density == "full":
            for i in range(8):
                _star(d, rnd.randint(0, W), rnd.randint(0, H), rnd.randint(8, 16), a2 + (220,))
    elif motif == "garland":
        # banderines chilenos colgando arriba
        cols = [(214, 48, 34, 255), (255, 255, 255, 255), (0, 57, 166, 255)]
        y0 = 150 if density == "full" else 90
        d.line([0, y0, W, y0 - 10], fill=(255, 255, 255, 160), width=4)
        step = 78
        for i, x in enumerate(range(10, W, step)):
            c = cols[i % 3]
            d.polygon([(x, y0), (x + step - 14, y0), (x + (step - 14) / 2, y0 + 70)], fill=c)
        if density == "full":
            for _ in range(10):
                _star(d, rnd.randint(0, W), rnd.randint(300, H - 200), rnd.randint(10, 22), a2 + (200,))
    elif motif == "sun":
        cx, cy = W - 120, 180
        for a_deg in range(0, 360, 20):
            r = math.radians(a_deg)
            d.line([cx, cy, cx + 260 * math.cos(r), cy + 260 * math.sin(r)],
                   fill=(255, 255, 255, 70), width=10)
        _blob(d, cx, cy, 90, (255, 240, 180, 230))
        if density == "full":
            for _ in range(12):
                _blob(d, rnd.randint(0, W), rnd.randint(0, H), rnd.randint(6, 14), (255, 255, 255, 120))
    elif motif == "mountains":
        if density == "full":
            d.polygon([(0, H), (W * 0.3, H * 0.55), (W * 0.6, H)], fill=(255, 255, 255, 35))
            d.polygon([(W * 0.4, H), (W * 0.72, H * 0.62), (W, H)], fill=(255, 255, 255, 28))
        for _ in range(10 if density == "full" else 4):
            _star(d, rnd.randint(0, W), rnd.randint(0, int(H * 0.35)), rnd.randint(6, 12), (255, 255, 255, 150))

    img.alpha_composite(layer)
    return img


def _sticker(draw, text, cx, y, style, rot=-5):
    """Rotated accent badge with a short exclamation."""
    f = display_font(46, 600)
    tmp = Image.new("RGBA", (10, 10))
    td = ImageDraw.Draw(tmp)
    tw = td.textlength(text, font=f)
    pad_x, pad_y, h = 34, 18, 46 + 36
    badge = Image.new("RGBA", (int(tw + pad_x * 2), h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.rounded_rectangle([0, 0, tw + pad_x * 2, h], radius=h // 2, fill=style["accent"] + (255,))
    bd.text((pad_x, pad_y - 4), text, font=f, fill=(255, 255, 255))
    badge = badge.rotate(rot, expand=True, resample=Image.BICUBIC)
    return badge


def _caption_block(base, caption, pet_name, brand, style):
    """Full-bleed layout: gradient scrim + sticker + bold caption card accent bar."""
    draw = ImageDraw.Draw(base)
    grad_h = 820
    g = Image.new("RGBA", (W, grad_h), (0, 0, 0, 0))
    alpha = Image.new("L", (1, grad_h))
    for y in range(grad_h):
        alpha.putpixel((0, y), int(245 * (y / (grad_h - 1)) ** 1.35))
    alpha = alpha.resize((W, grad_h))
    black = Image.new("RGBA", (W, grad_h), (0, 0, 0, 255))
    black.putalpha(alpha)
    base.alpha_composite(black, (0, H - grad_h))
    draw = ImageDraw.Draw(base)

    cap_f = body_font(60, 800)
    lines = _wrap(draw, caption, cap_f, W - 160)
    lh = 78
    y = H - 210 - len(lines) * lh
    # accent bar
    draw.rounded_rectangle([70, y - 4, 86, y + len(lines) * lh - 18], radius=8, fill=style["accent"])
    for ln in lines:
        draw.text((112, y + 3), ln, font=cap_f, fill=(0, 0, 0, 160))
        draw.text((110, y), ln, font=cap_f, fill=(255, 255, 255))
        y += lh
    return base


def photo_slide(img, caption, sticker, pet_name, brand, theme_key, variant=0):
    style = style_for(theme_key)
    if variant % 2 == 1:
        return _polaroid_slide(img, caption, sticker, pet_name, brand, style)

    base = _vignette(_cover(img), 110).convert("RGBA")
    apply_motif(base, style, density="light")
    base = _caption_block(base, caption, pet_name, brand, style)
    draw = ImageDraw.Draw(base)

    # pet name chip
    chip_f = body_font(34, 800)
    name = pet_name.upper()
    tw = draw.textlength(name, font=chip_f)
    draw.rounded_rectangle([60, 66, 60 + tw + 74, 142], radius=38, fill=style["accent"] + (240,))
    _paw(draw, 98, 104, 15, (255, 255, 255))
    draw.text((128, 80), name, font=chip_f, fill=(255, 255, 255))

    # sticker badge top-right (clear of caption)
    if sticker:
        badge = _sticker(draw, sticker, 0, 0, style, rot=6)
        base.alpha_composite(badge, (W - badge.width - 46, 150))

    # brand footer
    bf = body_font(28, 600)
    _paw(draw, 84, H - 70, 12, (255, 255, 255))
    draw.text((106, H - 86), brand, font=bf, fill=(255, 255, 255, 220))
    return base.convert("RGB")


def _polaroid_slide(img, caption, sticker, pet_name, brand, style):
    bg = _gradient(*style["grad"]).convert("RGBA")
    apply_motif(bg, style, density="full")
    draw = ImageDraw.Draw(bg)

    # photo as rotated white-framed card
    card_w, card_h = 760, 940
    photo = _cover(img, card_w - 56, card_h - 150, (0.5, 0.42))
    card = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 255))
    card.paste(photo, (28, 28))
    cd = ImageDraw.Draw(card)
    # handwritten caption inside polaroid bottom
    sf = script_font(60, 700)
    cl = _wrap(cd, caption, sf, card_w - 90)
    ty = card_h - 118
    for ln in cl[:2]:
        lw = cd.textlength(ln, font=sf)
        cd.text(((card_w - lw) / 2, ty), ln, font=sf, fill=(40, 36, 32))
        ty += 56
    card = _rounded(card, 24)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rot = -4
    rc = card.rotate(rot, expand=True, resample=Image.BICUBIC)
    px, py = (W - rc.width) // 2, 330
    sh = Image.new("RGBA", rc.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, rc.size[0], rc.size[1]], fill=(0, 0, 0, 90))
    sh = sh.rotate(0).filter(ImageFilter.GaussianBlur(24))
    bg.alpha_composite(Image.composite(sh, Image.new("RGBA", rc.size, (0, 0, 0, 0)), rc.split()[3]), (px + 10, py + 18))
    bg.alpha_composite(rc, (px, py))

    # sticker + name chip
    if sticker:
        badge = _sticker(draw, sticker, 0, 0, style, rot=6)
        bx = min(W // 2 - badge.width // 2 + 150, W - badge.width - 40)
        bg.alpha_composite(badge, (max(40, bx), 300))

    chip_f = body_font(34, 800)
    name = pet_name.upper()
    tw = draw.textlength(name, font=chip_f)
    draw.rounded_rectangle([(W - tw - 74) / 2, 180, (W + tw + 74) / 2, 256], radius=38, fill=(255, 255, 255, 240))
    _paw(draw, (W - tw - 74) / 2 + 38, 218, 15, style["accent"])
    draw.text(((W - tw - 74) / 2 + 68, 194), name, font=chip_f, fill=style["accent"])

    bf = display_font(34, 600)
    bw = draw.textlength(brand, font=bf)
    draw.text(((W - bw) / 2, H - 120), brand, font=bf, fill=(255, 255, 255, 230))
    return bg.convert("RGB")


def title_slide(title, pet_name, theme_label, brand, cover_img=None, theme_key=None):
    style = style_for(theme_key)
    if cover_img is not None:
        base = _cover(cover_img, center=(0.5, 0.38)).convert("RGBA")
        scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        alpha = Image.new("L", (1, H))
        for y in range(H):
            t = y / (H - 1)
            alpha.putpixel((0, y), int(60 + 180 * t))
        alpha = alpha.resize((W, H))
        tint = _gradient(style["grad"][0], style["grad"][1]).convert("RGBA")
        tint.putalpha(alpha.point(lambda p: int(p * 0.72)))
        base.alpha_composite(tint)
        base = _vignette(base.convert("RGB"), 120).convert("RGBA")
    else:
        base = _gradient(*style["grad"]).convert("RGBA")
    apply_motif(base, style, density="full")
    draw = ImageDraw.Draw(base)

    # theme badge
    tf = display_font(42, 600)
    tl = theme_label.upper()
    tw = draw.textlength(tl, font=tf)
    draw.rounded_rectangle([(W - tw) / 2 - 38, 1000, (W + tw) / 2 + 38, 1086], radius=43, fill=(255, 255, 255, 240))
    draw.text(((W - tw) / 2, 1016), tl, font=tf, fill=style["accent"])

    big = display_font(120, 700)
    lines = _wrap(draw, title, big, W - 150)
    y = 1180
    for ln in lines:
        lw = draw.textlength(ln, font=big)
        draw.text(((W - lw) / 2 + 3, y + 3), ln, font=big, fill=(0, 0, 0, 120))
        draw.text(((W - lw) / 2, y), ln, font=big, fill=(255, 255, 255))
        y += 132

    sf = script_font(94, 700)
    sub = f"por {pet_name}"
    sw = draw.textlength(sub, font=sf)
    draw.text(((W - sw) / 2, y + 24), sub, font=sf, fill=style["accent2"])

    bf = display_font(38, 600)
    bw = draw.textlength(brand, font=bf)
    _paw(draw, (W - bw) / 2 - 22, H - 118, 14, (255, 255, 255, 230))
    draw.text(((W - bw) / 2, H - 136), brand, font=bf, fill=(255, 255, 255, 235))
    return base.convert("RGB")


def closing_slide(pet_name, brand, brand_url, theme_key=None):
    style = style_for(theme_key)
    bg = _gradient(style["accent"] if False else (245, 166, 35), (224, 90, 71)).convert("RGBA")
    apply_motif(bg, style, density="full")
    draw = ImageDraw.Draw(bg)
    _paw(draw, W // 2, 600, 150, (255, 255, 255))

    f1 = display_font(88, 700)
    for i, ln in enumerate(_wrap(draw, "¿Y tu mascota?", f1, W - 150)):
        lw = draw.textlength(ln, font=f1)
        draw.text(((W - lw) / 2, 840 + i * 104), ln, font=f1, fill=(255, 255, 255))

    f2 = body_font(48, 600)
    y = 980
    for ln in _wrap(draw, "Crea la historia de tu regalón en", f2, W - 200):
        lw = draw.textlength(ln, font=f2)
        draw.text(((W - lw) / 2, y), ln, font=f2, fill=(255, 255, 255, 240))
        y += 64

    uf = display_font(72, 600)
    uw = draw.textlength(brand_url, font=uf)
    draw.rounded_rectangle([(W - uw) / 2 - 48, y + 40, (W + uw) / 2 + 48, y + 168], radius=55, fill=(255, 255, 255))
    draw.text(((W - uw) / 2, y + 66), brand_url, font=uf, fill=(224, 90, 71))
    return bg.convert("RGB")


def make_locked(clean, brand):
    img = clean.filter(ImageFilter.GaussianBlur(28)).convert("RGBA")
    img.alpha_composite(Image.new("RGBA", (W, H), (20, 15, 12, 150)))
    draw = ImageDraw.Draw(img)
    wf = display_font(46, 600)
    wm = Image.new("RGBA", (560, 160), (0, 0, 0, 0))
    ImageDraw.Draw(wm).text((10, 50), "VISTA PREVIA", font=wf, fill=(255, 255, 255, 60))
    wm = wm.rotate(28, expand=True)
    for ry in range(-200, H + 200, 300):
        for rx in range(-200, W + 200, 540):
            img.alpha_composite(wm, (rx, ry))
    cx, cy = W // 2, H // 2 - 60
    draw.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=(255, 255, 255, 240))
    draw.rounded_rectangle([cx - 52, cy - 10, cx + 52, cy + 78], radius=18, fill=(224, 90, 71))
    draw.arc([cx - 36, cy - 70, cx + 36, cy + 20], start=180, end=360, fill=(224, 90, 71), width=18)
    draw.ellipse([cx - 11, cy + 20, cx + 11, cy + 42], fill=(255, 255, 255))
    f = display_font(58, 600)
    msg = "Desbloquea tu historia"
    mw = draw.textlength(msg, font=f)
    draw.text((cx - mw / 2, cy + 150), msg, font=f, fill=(255, 255, 255))
    return img.convert("RGB")

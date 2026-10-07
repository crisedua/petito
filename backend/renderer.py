"""Compose 1080x1920 vertical story slides with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

W, H = 1080, 1920
FONT_DIR = Path(__file__).parent / "assets" / "fonts"

TERRACOTTA = (224, 90, 71)
TERRACOTTA_DARK = (168, 55, 40)
SAND = (250, 246, 240)
GOLD = (245, 166, 35)
INK = (26, 25, 24)
CREAM = (255, 251, 245)


def _font(file: str, size: int, weight: float | None = None) -> ImageFont.FreeTypeFont:
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


def _wrap(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
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


def _vertical_gradient(top, bottom, h, w=W):
    grad = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        grad.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return grad.resize((w, h))


def _cover(img: Image.Image, w=W, h=H) -> Image.Image:
    return ImageOps.fit(img, (w, h), Image.LANCZOS, centering=(0.5, 0.42))


def _paw(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    pr = int(r * 0.42)
    for dx, dy in [(-1.1, -1.25), (-0.1, -1.6), (1.1, -1.25)]:
        px, py = cx + dx * r, cy + dy * r
        draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=color)


def _brand_chip(draw, text, x, y, fsize=34):
    f = display_font(fsize, 600)
    tw = draw.textlength(text, font=f)
    pad = 22
    draw.rounded_rectangle([x, y, x + tw + pad * 2 + 46, y + fsize + 30], radius=40,
                           fill=(255, 255, 255, 230))
    _paw(draw, x + 30, y + (fsize + 30) // 2, 14, TERRACOTTA)
    draw.text((x + 58, y + 15), text, font=f, fill=TERRACOTTA)


def photo_slide(img: Image.Image, caption: str, pet_name: str, brand: str) -> Image.Image:
    base = _cover(img).convert("RGB")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # bottom gradient for caption legibility
    grad_h = 760
    g = _vertical_gradient((0, 0, 0), (0, 0, 0), grad_h).convert("RGBA")
    alpha = Image.new("L", (W, grad_h))
    for y in range(grad_h):
        alpha.putpixel((0, y), 0)
    alpha = Image.new("L", (1, grad_h))
    for y in range(grad_h):
        alpha.putpixel((0, y), int(235 * (y / (grad_h - 1)) ** 1.4))
    alpha = alpha.resize((W, grad_h))
    g.putalpha(alpha)
    overlay.paste(g, (0, H - grad_h), g)
    base = Image.alpha_composite(base.convert("RGBA"), overlay)
    draw = ImageDraw.Draw(base)

    # pet name chip top-left
    chip_f = body_font(36, 800)
    name_txt = pet_name.upper()
    tw = draw.textlength(name_txt, font=chip_f)
    draw.rounded_rectangle([60, 70, 60 + tw + 76, 150], radius=40, fill=(224, 90, 71, 235))
    _paw(draw, 100, 110, 16, (255, 255, 255))
    draw.text((132, 86), name_txt, font=chip_f, fill=(255, 255, 255))

    # caption
    cap_f = body_font(62, 800)
    lines = _wrap(draw, caption, cap_f, W - 150)
    lh = 80
    total = len(lines) * lh
    y = H - 230 - total
    for ln in lines:
        draw.text((72, y + 3), ln, font=cap_f, fill=(0, 0, 0))  # shadow
        draw.text((70, y), ln, font=cap_f, fill=(255, 255, 255))
        y += lh

    # brand footer
    bf = body_font(30, 600)
    _paw(draw, 86, H - 72, 13, (255, 255, 255))
    draw.text((112, H - 90), brand, font=bf, fill=(255, 255, 255, 220))
    return base.convert("RGB")


def title_slide(title: str, pet_name: str, theme_label: str, brand: str) -> Image.Image:
    bg = _vertical_gradient(TERRACOTTA, TERRACOTTA_DARK, H).convert("RGBA")
    draw = ImageDraw.Draw(bg)
    # decorative paws
    for (cx, cy, r, a) in [(150, 300, 70, 40), (950, 520, 90, 35), (880, 1500, 110, 30),
                           (200, 1650, 80, 38), (560, 180, 50, 45)]:
        _paw(draw, cx, cy, r, (255, 255, 255, a))

    # theme badge
    tf = display_font(44, 600)
    tlabel = theme_label.upper()
    tw = draw.textlength(tlabel, font=tf)
    draw.rounded_rectangle([(W - tw) / 2 - 40, 620, (W + tw) / 2 + 40, 710], radius=45,
                           fill=(255, 255, 255, 235))
    draw.text(((W - tw) / 2, 636), tlabel, font=tf, fill=TERRACOTTA)

    # title
    big = display_font(118, 700)
    lines = _wrap(draw, title, big, W - 160)
    y = 820
    for ln in lines:
        lw = draw.textlength(ln, font=big)
        draw.text(((W - lw) / 2, y), ln, font=big, fill=(255, 255, 255))
        y += 136

    # pet name script
    sf = script_font(96, 700)
    sub = f"por {pet_name}"
    sw = draw.textlength(sub, font=sf)
    draw.text(((W - sw) / 2, y + 30), sub, font=sf, fill=(255, 227, 180))

    bf = display_font(40, 600)
    bt = brand
    bw = draw.textlength(bt, font=bf)
    _paw(draw, (W - bw) / 2 - 24, H - 130, 15, (255, 255, 255, 230))
    draw.text(((W - bw) / 2, H - 150), bt, font=bf, fill=(255, 255, 255, 230))
    return bg.convert("RGB")


def closing_slide(pet_name: str, brand: str, brand_url: str) -> Image.Image:
    bg = _vertical_gradient((245, 166, 35), (224, 90, 71), H).convert("RGBA")
    draw = ImageDraw.Draw(bg)
    for (cx, cy, r, a) in [(180, 360, 80, 45), (900, 480, 100, 40), (820, 1560, 120, 35),
                           (240, 1500, 70, 42)]:
        _paw(draw, cx, cy, r, (255, 255, 255, a))

    _paw(draw, W // 2, 640, 150, (255, 255, 255))

    f1 = display_font(86, 700)
    l1 = _wrap(draw, "¿Y tu mascota?", f1, W - 160)
    y = 880
    for ln in l1:
        lw = draw.textlength(ln, font=f1)
        draw.text(((W - lw) / 2, y), ln, font=f1, fill=(255, 255, 255))
        y += 104

    f2 = body_font(50, 600)
    l2 = _wrap(draw, "Crea la historia de tu regalón en", f2, W - 220)
    y += 30
    for ln in l2:
        lw = draw.textlength(ln, font=f2)
        draw.text(((W - lw) / 2, y), ln, font=f2, fill=(255, 255, 255, 235))
        y += 66

    uf = display_font(72, 600)
    uw = draw.textlength(brand_url, font=uf)
    draw.rounded_rectangle([(W - uw) / 2 - 50, y + 40, (W + uw) / 2 + 50, y + 170], radius=55,
                           fill=(255, 255, 255))
    draw.text(((W - uw) / 2, y + 68), brand_url, font=uf, fill=TERRACOTTA)
    return bg.convert("RGB")


def make_locked(clean: Image.Image, brand: str) -> Image.Image:
    img = clean.filter(ImageFilter.GaussianBlur(28)).convert("RGBA")
    shade = Image.new("RGBA", (W, H), (20, 15, 12, 150))
    img = Image.alpha_composite(img, shade)
    draw = ImageDraw.Draw(img)

    # diagonal watermark tiles
    wf = display_font(46, 600)
    wm = Image.new("RGBA", (560, 160), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wm)
    wd.text((10, 50), "VISTA PREVIA", font=wf, fill=(255, 255, 255, 60))
    wm = wm.rotate(28, expand=True)
    for ry in range(-200, H + 200, 300):
        for rx in range(-200, W + 200, 540):
            img.alpha_composite(wm, (rx, ry))

    # lock badge center
    cx, cy = W // 2, H // 2 - 60
    draw.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=(255, 255, 255, 240))
    # simple padlock glyph
    draw.rounded_rectangle([cx - 52, cy - 10, cx + 52, cy + 78], radius=18, fill=TERRACOTTA)
    draw.arc([cx - 36, cy - 70, cx + 36, cy + 20], start=180, end=360, fill=TERRACOTTA, width=18)
    draw.ellipse([cx - 11, cy + 20, cx + 11, cy + 42], fill=(255, 255, 255))

    f = display_font(58, 600)
    msg = "Desbloquea tu historia"
    mw = draw.textlength(msg, font=f)
    draw.text((cx - mw / 2, cy + 150), msg, font=f, fill=(255, 255, 255))

    bf = display_font(36, 600)
    bt = brand
    bw = draw.textlength(bt, font=bf)
    draw.text((cx - bw / 2, H - 140), bt, font=bf, fill=(255, 255, 255, 220))
    return img.convert("RGB")

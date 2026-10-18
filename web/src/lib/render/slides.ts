/** Story slides (title, photo full-bleed / polaroid, closing), ported from backend/renderer.py. */
import type { Image, SKRSContext2D } from "@napi-rs/canvas";
import { bodyFont, displayFont, scriptFont } from "./fonts";
import {
  H, W, applyMotif, canvas, drawCover, fillGradient, paw, rgba, rotated, roundRect, styleFor, textWidth, vignette, wrap,
  type Style,
} from "./core";

/** Rotated accent badge with a short exclamation. */
function stickerBadge(text: string, style: Style, rot: number) {
  const f = displayFont(46, 600);
  const [, m] = canvas(10, 10);
  const tw = textWidth(m, text, f);
  const padX = 34, padY = 18, h = 46 + 36;
  const w = tw + padX * 2;
  return rotated(w, h, rot, (ctx) => {
    roundRect(ctx, 0, 0, w, h, h / 2, rgba(style.accent));
    ctx.font = f;
    ctx.fillStyle = "#fff";
    ctx.fillText(text, padX, padY - 4);
  });
}

function captionBlock(ctx: SKRSContext2D, caption: string, style: Style) {
  const gradH = 820;
  for (let y = 0; y < gradH; y++) {
    ctx.fillStyle = `rgba(0,0,0,${(245 * Math.pow(y / (gradH - 1), 1.35)) / 255})`;
    ctx.fillRect(0, H - gradH + y, W, 1);
  }
  const f = bodyFont(60, 800);
  const lines = wrap(ctx, caption, f, W - 160);
  const lh = 78;
  let y = H - 210 - lines.length * lh;
  roundRect(ctx, 70, y - 4, 86, y + lines.length * lh - 18, 8, rgba(style.accent));
  ctx.font = f;
  for (const ln of lines) {
    ctx.fillStyle = "rgba(0,0,0,0.63)";
    ctx.fillText(ln, 112, y + 3);
    ctx.fillStyle = "#fff";
    ctx.fillText(ln, 110, y);
    y += lh;
  }
}

function nameChip(ctx: SKRSContext2D, petName: string, x0: number, y0: number, bg: string, fg: string) {
  const f = bodyFont(34, 800);
  const name = petName.toUpperCase();
  const tw = textWidth(ctx, name, f);
  roundRect(ctx, x0, y0, x0 + tw + 74, y0 + 76, 38, bg);
  paw(ctx, x0 + 38, y0 + 38, 15, fg);
  ctx.font = f;
  ctx.fillStyle = fg;
  ctx.fillText(name, x0 + 68, y0 + 14);
}

export function photoSlide(img: Image, caption: string, sticker: string, petName: string, brand: string, theme: string, variant = 0) {
  const style = styleFor(theme);
  if (variant % 2 === 1) return polaroidSlide(img, caption, sticker, petName, brand, style);
  const [c, ctx] = canvas();
  drawCover(ctx, img, 0, 0, W, H);
  vignette(ctx, 110);
  applyMotif(ctx, style, "light");
  captionBlock(ctx, caption, style);
  nameChip(ctx, petName, 60, 66, rgba(style.accent, 240), "#fff");
  if (sticker) {
    const b = stickerBadge(sticker, style, 6);
    ctx.drawImage(b, W - b.width - 46, 150);
  }
  paw(ctx, 84, H - 70, 12, "#fff");
  ctx.font = bodyFont(28, 600);
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText(brand, 106, H - 86);
  return c;
}

function polaroidSlide(img: Image, caption: string, sticker: string, petName: string, brand: string, style: Style) {
  const [c, ctx] = canvas();
  fillGradient(ctx, style.grad[0], style.grad[1]);
  applyMotif(ctx, style, "full");

  const cardW = 760, cardH = 940, rot = -4;
  const card = rotated(cardW, cardH, rot, (cc) => {
    cc.beginPath();
    cc.roundRect(0, 0, cardW, cardH, 24);
    cc.clip();
    cc.fillStyle = "#fff";
    cc.fillRect(0, 0, cardW, cardH);
    drawCover(cc, img, 28, 28, cardW - 56, cardH - 150, [0.5, 0.42]);
    const sf = scriptFont(60, 700);
    const lines = wrap(cc, caption, sf, cardW - 90).slice(0, 2);
    let ty = cardH - 118;
    cc.font = sf;
    cc.fillStyle = "rgb(40,36,32)";
    for (const ln of lines) {
      cc.fillText(ln, (cardW - cc.measureText(ln).width) / 2, ty);
      ty += 56;
    }
  });
  const px = Math.floor((W - card.width) / 2), py = 330;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(card, px, py);
  ctx.restore();

  if (sticker) {
    const b = stickerBadge(sticker, style, 6);
    const bx = Math.min(Math.floor(W / 2 - b.width / 2 + 150), W - b.width - 40);
    ctx.drawImage(b, Math.max(40, bx), 300);
  }
  const f = bodyFont(34, 800);
  const tw = textWidth(ctx, petName.toUpperCase(), f);
  nameChip(ctx, petName, (W - tw - 74) / 2, 180, "rgba(255,255,255,0.94)", rgba(style.accent));

  const bf = displayFont(34, 600);
  ctx.font = bf;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(brand, (W - ctx.measureText(brand).width) / 2, H - 120);
  return c;
}

export function titleSlide(title: string, petName: string, themeLabel: string, brand: string, cover: Image | null, theme: string) {
  const style = styleFor(theme);
  const [c, ctx] = canvas();
  if (cover) {
    drawCover(ctx, cover, 0, 0, W, H, [0.5, 0.38]);
    // theme tint: alpha ramps 60→240 top to bottom, scaled by 0.72
    const [t0, t1] = style.grad;
    for (let y = 0; y < H; y += 2) {
      const t = y / (H - 1);
      const col = t0.map((v, i) => Math.round(v + (t1[i] - v) * t));
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${((60 + 180 * t) * 0.72) / 255})`;
      ctx.fillRect(0, y, W, 2);
    }
    vignette(ctx, 120);
  } else {
    fillGradient(ctx, style.grad[0], style.grad[1]);
  }
  applyMotif(ctx, style, "full");

  const tf = displayFont(42, 600);
  const tl = themeLabel.toUpperCase();
  const tw = textWidth(ctx, tl, tf);
  roundRect(ctx, (W - tw) / 2 - 38, 1000, (W + tw) / 2 + 38, 1086, 43, "rgba(255,255,255,0.94)");
  ctx.font = tf;
  ctx.fillStyle = rgba(style.accent);
  ctx.fillText(tl, (W - tw) / 2, 1016);

  const big = displayFont(120, 700);
  let y = 1180;
  for (const ln of wrap(ctx, title, big, W - 150)) {
    ctx.font = big;
    const lw = ctx.measureText(ln).width;
    ctx.fillStyle = "rgba(0,0,0,0.47)";
    ctx.fillText(ln, (W - lw) / 2 + 3, y + 3);
    ctx.fillStyle = "#fff";
    ctx.fillText(ln, (W - lw) / 2, y);
    y += 132;
  }
  const sf = scriptFont(94, 700);
  const sub = `por ${petName}`;
  ctx.font = sf;
  ctx.fillStyle = rgba(style.accent2);
  ctx.fillText(sub, (W - ctx.measureText(sub).width) / 2, y + 24);

  const bf = displayFont(38, 600);
  const bw = textWidth(ctx, brand, bf);
  paw(ctx, (W - bw) / 2 - 22, H - 118, 14, "rgba(255,255,255,0.9)");
  ctx.font = bf;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(brand, (W - bw) / 2, H - 136);
  return c;
}

export function closingSlide(brand: string, brandUrl: string, theme: string) {
  const style = styleFor(theme);
  const [c, ctx] = canvas();
  fillGradient(ctx, [245, 166, 35], [224, 90, 71]);
  applyMotif(ctx, style, "full");
  paw(ctx, W / 2, 600, 150, "#fff");

  const f1 = displayFont(88, 700);
  wrap(ctx, "¿Y tu mascota?", f1, W - 150).forEach((ln, i) => {
    ctx.font = f1;
    ctx.fillStyle = "#fff";
    ctx.fillText(ln, (W - ctx.measureText(ln).width) / 2, 840 + i * 104);
  });
  const f2 = bodyFont(48, 600);
  let y = 980;
  for (const ln of wrap(ctx, "Crea la historia de tu regalón en", f2, W - 200)) {
    ctx.font = f2;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillText(ln, (W - ctx.measureText(ln).width) / 2, y);
    y += 64;
  }
  const uf = displayFont(72, 600);
  const uw = textWidth(ctx, brandUrl, uf);
  roundRect(ctx, (W - uw) / 2 - 48, y + 40, (W + uw) / 2 + 48, y + 168, 55, "#fff");
  ctx.font = uf;
  ctx.fillStyle = "rgb(224,90,71)";
  ctx.fillText(brandUrl, (W - uw) / 2, y + 66);
  return c;
}

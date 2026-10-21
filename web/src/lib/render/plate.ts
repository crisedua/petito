/**
 * Finishing touches on photo-based portraits: a name plate with a noble title at the bottom, and a
 * single "before and after" image people can share (the press-and-hold reveal, but for everyone).
 */
import sharp from "sharp";
import { bodyFont, displayFont, scriptFont } from "./fonts";
import { canvas, decode, drawCover, roundRect, textWidth } from "./core";

/** A brass name plate ("Michi, Duquesa de Viña") along the bottom edge of the portrait. */
export async function namePlate(image: Buffer, title: string): Promise<Buffer> {
  const img = await decode(await sharp(image).rotate().jpeg({ quality: 95 }).toBuffer());
  const w = img.width, h = img.height;
  const [c, ctx] = canvas(w, h);
  ctx.drawImage(img, 0, 0);
  const size = Math.round(w / 19);
  const font = displayFont(size, 700);
  const tw = textWidth(ctx, title, font);
  const padX = size * 1.1, plateH = size * 2.1;
  const pw = Math.min(w - size * 2, tw + padX * 2);
  const x0 = (w - pw) / 2, y0 = h - plateH - size * 1.2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = size * 0.8; ctx.shadowOffsetY = size * 0.25;
  const brass = ctx.createLinearGradient(x0, y0, x0, y0 + plateH);
  brass.addColorStop(0, "#F3D27A"); brass.addColorStop(0.5, "#B8862B"); brass.addColorStop(1, "#E9C25E");
  roundRect(ctx, x0, y0, x0 + pw, y0 + plateH, size * 0.35, brass as unknown as string);
  ctx.restore();
  ctx.strokeStyle = "rgba(90,60,10,0.55)"; ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.beginPath(); ctx.roundRect(x0 + size * 0.22, y0 + size * 0.22, pw - size * 0.44, plateH - size * 0.44, size * 0.25); ctx.stroke();
  // engraved look: light highlight under a dark text
  ctx.font = font;
  const tx = (w - Math.min(tw, pw - padX * 2)) / 2, ty = y0 + (plateH - size) / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 + padX / 2, y0, pw - padX, plateH); ctx.clip();
  ctx.fillStyle = "rgba(255,245,210,0.55)"; ctx.fillText(title, tx, ty + Math.max(1, size * 0.05));
  ctx.fillStyle = "#3B2708"; ctx.fillText(title, tx, ty);
  ctx.restore();
  return c.encode("jpeg", 94);
}

/** Original and result side by side (1200×860) with "Antes" / "Después" labels and the brand. */
export async function compareImage(original: Buffer, result: Buffer, brand = "petito.pro"): Promise<Buffer> {
  const [a, b] = await Promise.all([original, result].map(async (buf) => decode(await sharp(buf).rotate().resize(900, 900, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer())));
  const W = 1200, H = 860, gap = 16, top = 40, bottom = 70;
  const pw = (W - gap * 3) / 2, ph = H - top - bottom;
  const [c, ctx] = canvas(W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#FBF6EE"); bg.addColorStop(1, "#EFE2CF");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const panel = (img: typeof a, x: number, label: string) => {
    ctx.save();
    ctx.shadowColor = "rgba(40,25,10,0.3)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    roundRect(ctx, x, top, x + pw, top + ph, 22, "#fff");
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 8, top + 8, pw - 16, ph - 16, 16); ctx.clip();
    drawCover(ctx, img, x + 8, top + 8, pw - 16, ph - 16, [0.5, 0.35]);
    ctx.restore();
    const f = displayFont(30, 700);
    const lw = textWidth(ctx, label, f) + 36;
    roundRect(ctx, x + 22, top + 22, x + 22 + lw, top + 68, 23, "rgba(0,0,0,0.62)");
    ctx.font = f; ctx.fillStyle = "#fff"; ctx.fillText(label, x + 40, top + 30);
  };
  panel(a, gap, "Antes");
  panel(b, gap * 2 + pw, "Después");
  const f2 = scriptFont(40); ctx.font = f2; ctx.fillStyle = "#B85C3C";
  const tag = `hecho en ${brand} 🐾`.replace(" 🐾", "");
  ctx.fillText(tag, (W - textWidth(ctx, tag, f2)) / 2, H - bottom + 2);
  const f3 = bodyFont(18, 600); ctx.font = f3; ctx.fillStyle = "rgba(58,42,32,0.55)";
  const sub = "Sube la foto de tu mascota y mírala así en un minuto";
  ctx.fillText(sub, (W - textWidth(ctx, sub, f3)) / 2, H - 22);
  return c.encode("jpeg", 90);
}

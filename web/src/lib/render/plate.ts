/**
 * Finishing touches on photo-based portraits: a name plate with a noble title at the bottom, and a
 * single "before and after" image people can share (the press-and-hold reveal, but for everyone).
 */
import sharp from "sharp";
import { bodyFont, displayFont, scriptFont } from "./fonts";
import { canvas, decode, drawCover, roundRect, textWidth } from "./core";

/** A brass name plate ("Michi, Duquesa de Viña") along the bottom edge of the portrait. */
export async function namePlate(image: Buffer, title: string, sub?: string | null): Promise<Buffer> {
  const img = await decode(await sharp(image).rotate().jpeg({ quality: 95 }).toBuffer());
  const w = img.width, h = img.height;
  const [c, ctx] = canvas(w, h);
  ctx.drawImage(img, 0, 0);
  const subText = (sub ?? "").trim();
  const size = Math.round(w / 19), subSize = Math.round(size * 0.62);
  const font = displayFont(size, 700), subFont = scriptFont(Math.round(subSize * 1.25));
  const tw = Math.max(textWidth(ctx, title, font), subText ? textWidth(ctx, subText, subFont) : 0);
  const padX = size * 1.1, plateH = subText ? size * 2.1 + subSize * 1.35 : size * 2.1;
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
  const engrave = (text: string, f: string, fs: number, y: number) => {
    ctx.font = f;
    const t = textWidth(ctx, text, f);
    const x = (w - Math.min(t, pw - padX)) / 2;
    ctx.fillStyle = "rgba(255,245,210,0.55)"; ctx.fillText(text, x, y + Math.max(1, fs * 0.05));
    ctx.fillStyle = "#3B2708"; ctx.fillText(text, x, y);
  };
  ctx.save(); ctx.beginPath(); ctx.rect(x0 + padX / 2, y0, pw - padX, plateH); ctx.clip();
  const ty = subText ? y0 + size * 0.45 : y0 + (plateH - size) / 2;
  engrave(title, font, size, ty);
  if (subText) engrave(subText, subFont, subSize, ty + size * 1.15);
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

/**
 * Illustration styles: the AI drawing on cream paper with the pet's name (and a caption) as real text,
 * like a gallery print. Output 900×1200.
 */
export async function posterCompose(image: Buffer, petName: string | null, caption: string | null): Promise<Buffer> {
  const OW = 900, OH = 1200;
  const name = (petName ?? "").trim(), cap = (caption ?? "").trim();
  const img = await decode(await sharp(image).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 94 }).toBuffer());
  const [c, ctx] = canvas(OW, OH);
  ctx.fillStyle = "#FBF8F2"; ctx.fillRect(0, 0, OW, OH);
  const textBlock = name || cap ? (name ? 90 : 0) + (cap ? 60 : 0) + 30 : 0;
  const margin = 60, areaH = OH - margin * 2 - textBlock, areaW = OW - margin * 2;
  // Keep the whole drawing (no crop) and hide the AI's background edges by drawing on the same cream.
  const scale = Math.min(areaW / img.width, areaH / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  const dx = (OW - dw) / 2, dy = margin + (areaH - dh) / 2;
  ctx.save(); ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, 6); ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  let y = margin + areaH + 24;
  if (name) {
    const f = displayFont(64, 700); ctx.font = f; ctx.fillStyle = "#2B2118";
    ctx.fillText(name, (OW - textWidth(ctx, name, f)) / 2, y);
    y += 86;
  }
  if (cap) {
    const f = scriptFont(44); ctx.font = f; ctx.fillStyle = "#8A6D4B";
    ctx.fillText(cap, (OW - textWidth(ctx, cap, f)) / 2, y);
  }
  return c.encode("jpeg", 94);
}

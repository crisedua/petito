/** Locked story slide, portrait preview and talking-video source frame (renderer.py ports). */
import sharp from "sharp";
import { displayFont } from "./fonts";
import { H, W, canvas, decode, rotated, roundRect, textWidth, toJpeg } from "./core";

/** Blurred, darkened, "VISTA PREVIA"-tiled version of a slide with a padlock. */
export async function makeLocked(cleanJpeg: Buffer, quality = 82) {
  const blurred = await sharp(cleanJpeg).blur(28).jpeg({ quality: 92 }).toBuffer();
  const [c, ctx] = canvas();
  ctx.drawImage(await decode(blurred), 0, 0, W, H);
  ctx.fillStyle = "rgba(20,15,12,0.59)";
  ctx.fillRect(0, 0, W, H);
  const wm = rotated(560, 160, 28, (w) => {
    w.font = displayFont(46, 600);
    w.fillStyle = "rgba(255,255,255,0.235)";
    w.fillText("VISTA PREVIA", 10, 50);
  });
  for (let ry = -200; ry < H + 200; ry += 300) for (let rx = -200; rx < W + 200; rx += 540) ctx.drawImage(wm, rx, ry);
  const cx = W / 2, cy = H / 2 - 60;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath(); ctx.arc(cx, cy, 110, 0, Math.PI * 2); ctx.fill();
  roundRect(ctx, cx - 52, cy - 10, cx + 52, cy + 78, 18, "rgb(224,90,71)");
  ctx.strokeStyle = "rgb(224,90,71)";
  ctx.lineWidth = 18;
  ctx.beginPath(); ctx.arc(cx, cy - 25, 36 - 9, Math.PI, 2 * Math.PI); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx, cy + 31, 11, 0, Math.PI * 2); ctx.fill();
  const f = displayFont(58, 600);
  const msg = "Desbloquea tu historia";
  ctx.font = f;
  ctx.fillText(msg, cx - textWidth(ctx, msg, f) / 2, cy + 150);
  return toJpeg(c, quality);
}

function stampTile(brand: string, size: number, alphaA: number, alphaB?: number) {
  const f = displayFont(size, 600);
  const [, m] = canvas(10, 10);
  const tw = textWidth(m, brand, f);
  return rotated(Math.ceil(tw) + 40, Math.ceil(size * 1.6), 30, (s) => {
    s.font = f;
    if (alphaB !== undefined) {
      s.fillStyle = `rgba(255,255,255,${alphaA / 255})`;
      s.fillText(brand, 22, 6);
      s.fillStyle = `rgba(255,255,255,${alphaB / 255})`;
      s.fillText(brand, 20, 4);
    } else {
      s.fillStyle = `rgba(255,255,255,${alphaA / 255})`;
      s.fillText(brand, 20, 6);
    }
  });
}

/**
 * Free preview of a portrait: the picture itself, at most 900 px, with one small "petipop.pro" mark in
 * a corner. No tiled stamp: the preview has to look good enough to share. HD and no mark come with Plus.
 */
export async function portraitPreview(clean: Buffer, brand = "Petipop", maxSide = 900, quality = 82) {
  const small = await sharp(clean).resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 95 }).toBuffer();
  const img = await decode(small);
  const w = img.width, h = img.height;
  const [c, ctx] = canvas(w, h);
  ctx.drawImage(img, 0, 0);
  const label = brand.toLowerCase().includes(".") ? brand : `${brand.toLowerCase()}.pro`;
  const size = Math.max(16, Math.round(w / 34));
  const f = displayFont(size, 600);
  const tw = textWidth(ctx, label, f);
  const padX = size * 0.7, padY = size * 0.4, m = size * 0.9;
  const x0 = w - tw - padX * 2 - m, y0 = h - size - padY * 2 - m;
  roundRect(ctx, x0, y0, w - m, h - m, size * 0.6, "rgba(0,0,0,0.38)");
  ctx.font = f; ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(label, x0 + padX, y0 + padY);
  return toJpeg(c, quality);
}

/**
 * Cover-crop to 9:16 at `outWidth` and (for the free preview) bake in the Petipop watermark, so the
 * generated video carries it without any video post-processing.
 */
export async function talkSource(photo: Buffer, watermark: boolean, outWidth = 720, brand = "Petipop", quality = 90) {
  const outH = Math.round((outWidth * 16) / 9);
  const cropped = await sharp(photo).resize(outWidth, outH, { fit: "cover", position: "centre" }).jpeg({ quality: 95 }).toBuffer();
  if (!watermark) return sharp(cropped).jpeg({ quality }).toBuffer();
  const img = await decode(cropped);
  const [c, ctx] = canvas(outWidth, outH);
  ctx.drawImage(img, 0, 0);
  const stamp = stampTile(brand, Math.max(26, Math.floor(outWidth / 11)), 55);
  const stepX = Math.floor(stamp.width * 0.95), stepY = Math.floor(stamp.height * 1.7);
  for (let ry = -stamp.height; ry < outH + stamp.height; ry += stepY)
    for (let rx = -stamp.width; rx < outWidth + stamp.width; rx += stepX) ctx.drawImage(stamp, rx, ry);
  const size = Math.max(30, Math.floor(outWidth / 9));
  const f = displayFont(size, 700);
  const bw = textWidth(ctx, brand, f);
  const bx = (outWidth - bw) / 2, by = outH - size * 1.9;
  ctx.font = f;
  ctx.fillStyle = "rgba(0,0,0,0.43)";
  ctx.fillText(brand, bx + 2, by + 2);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(brand, bx, by);
  return toJpeg(c, quality);
}

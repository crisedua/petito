/**
 * "Tu foto, mejorada" styles: the real photo, untouched, in a polaroid, on a magazine cover or as a
 * vintage print. No AI involved. Output is a 900×1200 JPEG (3:4), like the AI portraits.
 */
import sharp from "sharp";
import { bodyFont, displayFont, scriptFont } from "./fonts";
import { canvas, decode, drawCover, roundRect, textWidth, wrap } from "./core";

const OW = 900, OH = 1200;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const today = () => { const d = new Date(); return `${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

async function photo(buf: Buffer) {
  // EXIF-rotate and cap size once, so every style starts from the same clean picture.
  return decode(await sharp(buf).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer());
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);
  ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.9, cy - r * 1.3, cx, cy - r * 0.45);
  ctx.bezierCurveTo(cx + r * 0.9, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r);
  ctx.fill();
  ctx.restore();
}

function paperTexture(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 3) {
  let a = seed;
  const r = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
  ctx.save();
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.03})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.restore();
}

/** A polaroid pinned slightly askew on a warm wall, the pet's name handwritten under it. */
export async function polaroid(buf: Buffer, petName: string | null, caption?: string | null): Promise<Buffer> {
  const img = await photo(buf);
  const [c, ctx] = canvas(OW, OH);
  const bg = ctx.createLinearGradient(0, 0, 0, OH);
  bg.addColorStop(0, "#F6EEE3"); bg.addColorStop(1, "#E8D9C6");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, OW, OH);
  paperTexture(ctx as any, OW, OH);
  const pw = 720, ph = 880, pad = 36, photoH = 690;
  const [card, cc] = canvas(pw, ph);
  cc.fillStyle = "#FFFDF8"; cc.fillRect(0, 0, pw, ph);
  drawCover(cc, img, pad, pad, pw - pad * 2, photoH, [0.5, 0.4]);
  // subtle inner shadow around the photo
  cc.strokeStyle = "rgba(0,0,0,0.12)"; cc.lineWidth = 2; cc.strokeRect(pad + 1, pad + 1, pw - pad * 2 - 2, photoH - 2);
  const name = (petName ?? "").trim();
  const line = name || "mi regalón";
  cc.fillStyle = "#2F3E6E";
  const f = scriptFont(66);
  cc.font = f;
  const lw = textWidth(cc, line, f);
  cc.fillText(line, (pw - lw) / 2 - 18, pad + photoH + 34);
  heart(cc as any, (pw + lw) / 2 + 22, pad + photoH + 66, 15, "rgb(224,90,71)"); // the script font has no ♥ glyph
  const sub = (caption ?? "").trim() || today();
  const f2 = scriptFont(34); cc.font = f2; cc.fillStyle = "rgba(47,62,110,0.75)";
  cc.fillText(sub, (pw - textWidth(cc, sub, f2)) / 2, pad + photoH + 112);
  ctx.save();
  ctx.translate(OW / 2, OH / 2 + 10);
  ctx.rotate((-3.5 * Math.PI) / 180);
  ctx.shadowColor = "rgba(40,25,10,0.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.drawImage(card, -pw / 2, -ph / 2);
  ctx.restore();
  // washi tape on top
  ctx.save();
  ctx.translate(OW / 2, OH / 2 - ph / 2 + 18);
  ctx.rotate((4 * Math.PI) / 180);
  ctx.fillStyle = "rgba(224,90,71,0.55)";
  ctx.fillRect(-110, -22, 220, 44);
  ctx.restore();
  return c.encode("jpeg", 92);
}

/** The pet on the cover of "PETIPOP" magazine, with its name as the headline. */
export async function magazineCover(buf: Buffer, petName: string | null): Promise<Buffer> {
  const img = await photo(buf);
  const [c, ctx] = canvas(OW, OH);
  drawCover(ctx, img, 0, 0, OW, OH, [0.5, 0.35]);
  // darken top and bottom so text reads
  const top = ctx.createLinearGradient(0, 0, 0, 330); top.addColorStop(0, "rgba(0,0,0,0.55)"); top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top; ctx.fillRect(0, 0, OW, 330);
  const bot = ctx.createLinearGradient(0, OH - 520, 0, OH); bot.addColorStop(0, "rgba(0,0,0,0)"); bot.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = bot; ctx.fillRect(0, OH - 520, OW, 520);
  // masthead
  ctx.fillStyle = "#FFFFFF";
  const mast = displayFont(150, 700); ctx.font = mast;
  ctx.fillText("PETIPOP", (OW - textWidth(ctx, "PETIPOP", mast)) / 2, 40);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const small = bodyFont(24, 700); ctx.font = small;
  const d = new Date();
  const issue = `${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}  ·  EDICIÓN ESPECIAL`;
  ctx.fillText(issue, (OW - textWidth(ctx, issue, small)) / 2, 200);
  // side teasers
  ctx.fillStyle = "#FFFFFF";
  const teaser = bodyFont(30, 800);
  const teasers = ["LA MASCOTA", "DEL AÑO", "", "SECRETOS", "DE UNA SIESTA", "PERFECTA"];
  teasers.forEach((t, i) => { ctx.font = teaser; ctx.fillText(t, 44, 420 + i * 40); });
  // headline (pet name)
  const name = (petName ?? "").trim() || "Mi regalón";
  let size = 170;
  let hf = displayFont(size, 700);
  while (textWidth(ctx, name, hf) > OW - 90 && size > 70) { size -= 10; hf = displayFont(size, 700); }
  ctx.fillStyle = "#F5C355"; ctx.font = hf;
  ctx.fillText(name, 44, OH - 330);
  ctx.fillStyle = "#FFFFFF";
  const sub = bodyFont(34, 800); ctx.font = sub;
  ctx.fillText("“Sí, soy el más choro del barrio”", 44, OH - 150);
  const sub2 = bodyFont(26, 700); ctx.font = sub2; ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Entrevista exclusiva · Fotos nunca vistas", 44, OH - 98);
  // barcode
  ctx.fillStyle = "#FFFFFF"; roundRect(ctx, OW - 190, OH - 110, OW - 40, OH - 40, 6, "#FFFFFF");
  ctx.fillStyle = "#111";
  for (let x = OW - 180, i = 0; x < OW - 50; x += 6, i++) ctx.fillRect(x, OH - 100, i % 3 === 0 ? 3 : 2, 50);
  return c.encode("jpeg", 92);
}

/** Sepia print with a cream album border, rounded corners and a handwritten date. */
export async function vintagePrint(buf: Buffer, petName: string | null): Promise<Buffer> {
  const sepia = await sharp(buf).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .modulate({ saturation: 0.2, brightness: 1.08 }).tint({ r: 160, g: 120, b: 70 }).linear(0.95, 10).jpeg({ quality: 92 }).toBuffer();
  const img = await decode(sepia);
  const [c, ctx] = canvas(OW, OH);
  ctx.fillStyle = "#EFE4CF"; ctx.fillRect(0, 0, OW, OH);
  paperTexture(ctx as any, OW, OH, 11);
  const m = 70, ph = 930;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(m, m, OW - m * 2, ph, 14); ctx.clip();
  drawCover(ctx, img, m, m, OW - m * 2, ph, [0.5, 0.42]);
  // vignette + light leak
  const v = ctx.createRadialGradient(OW / 2, m + ph / 2, 200, OW / 2, m + ph / 2, 700);
  v.addColorStop(0, "rgba(60,30,0,0)"); v.addColorStop(1, "rgba(60,30,0,0.3)");
  ctx.fillStyle = v; ctx.fillRect(m, m, OW - m * 2, ph);
  const leak = ctx.createLinearGradient(OW - 300, 0, OW, 0);
  leak.addColorStop(0, "rgba(255,170,60,0)"); leak.addColorStop(1, "rgba(255,170,60,0.28)");
  ctx.fillStyle = leak; ctx.fillRect(OW - 300, m, 300, ph);
  ctx.restore();
  ctx.strokeStyle = "rgba(90,60,20,0.25)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(m, m, OW - m * 2, ph, 14); ctx.stroke();
  // photo corners
  ctx.fillStyle = "rgba(60,40,15,0.55)";
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [OW - m, m, -1, 1], [m, m + ph, 1, -1], [OW - m, m + ph, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 64, y); ctx.lineTo(x, y + dy * 64); ctx.closePath(); ctx.fill();
  }
  const name = (petName ?? "").trim();
  const text = name ? `${name}, ${today()}` : today();
  ctx.fillStyle = "#4A3722";
  const f = scriptFont(52); ctx.font = f;
  const lines = wrap(ctx, text, f, OW - 160);
  lines.forEach((l, i) => ctx.fillText(l, (OW - textWidth(ctx, l, f)) / 2, m + ph + 40 + i * 60));
  return c.encode("jpeg", 92);
}

export async function renderPhotoStyle(style: string, buf: Buffer, petName: string | null): Promise<Buffer> {
  if (style === "polaroid") return polaroid(buf, petName);
  if (style === "revista") return magazineCover(buf, petName);
  if (style === "antigua") return vintagePrint(buf, petName);
  throw new Error(`No renderer for style ${style}`);
}

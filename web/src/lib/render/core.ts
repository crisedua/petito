/** Drawing primitives and theme motifs, ported from backend/renderer.py (1080x1920 slides). */
import { createCanvas, loadImage, type Canvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFonts } from "./fonts";

export const W = 1080;
export const H = 1920;
export type RGB = [number, number, number];
export type Style = { grad: [RGB, RGB]; accent: RGB; accent2: RGB; motif: "confetti" | "mountains" | "sun" | "garland" | "snow" };

export const THEME_STYLE: Record<string, Style> = {
  mi_ano: { grad: [[247, 196, 92], [224, 112, 60]], accent: [224, 90, 71], accent2: [255, 255, 255], motif: "confetti" },
  mis_aventuras: { grad: [[96, 150, 128], [30, 58, 50]], accent: [245, 166, 35], accent2: [255, 255, 255], motif: "mountains" },
  un_dia: { grad: [[252, 214, 134], [240, 146, 104]], accent: [224, 90, 71], accent2: [255, 255, 255], motif: "sun" },
  dieciochero: { grad: [[214, 48, 34], [138, 24, 18]], accent: [0, 57, 166], accent2: [255, 255, 255], motif: "garland" },
  navidad: { grad: [[22, 112, 72], [9, 56, 38]], accent: [213, 43, 30], accent2: [245, 200, 90], motif: "snow" },
};
export const styleFor = (theme?: string | null): Style => THEME_STYLE[theme ?? ""] ?? THEME_STYLE.mi_ano;

/** Pillow-style colour with 0-255 alpha → CSS. */
export const rgba = (c: RGB | number[], a = 255) => `rgba(${c[0]},${c[1]},${c[2]},${(c.length > 3 ? c[3] : a) / 255})`;

export function canvas(w = W, h = H): [Canvas, SKRSContext2D] {
  ensureFonts();
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.textBaseline = "top"; // Pillow anchors text at its top-left
  return [c, ctx];
}

export const toJpeg = (c: Canvas, quality = 90) => c.encode("jpeg", quality);
export const decode = (buf: Buffer): Promise<Image> => loadImage(buf);

/** Seeded PRNG standing in for Python's random.Random(7) (same idea, not the same sequence). */
export function rng(seed = 7) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random: next,
    randint: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    choice: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length)],
  };
}

export function wrap(ctx: SKRSContext2D, text: string, font: string, maxW: number): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const test = (cur + " " + w).trim();
    if (ctx.measureText(test).width <= maxW) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export const textWidth = (ctx: SKRSContext2D, text: string, font: string) => {
  ctx.font = font;
  return ctx.measureText(text).width;
};

export function fillGradient(ctx: SKRSContext2D, top: RGB, bottom: RGB, w = W, h = H) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(top));
  g.addColorStop(1, rgba(bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** ImageOps.fit: crop to the target aspect around `center`, then scale to w×h. */
export function drawCover(ctx: SKRSContext2D, img: Image, x: number, y: number, w: number, h: number, center: [number, number] = [0.5, 0.42]) {
  const iw = img.width, ih = img.height;
  const target = w / h;
  let sw = iw, sh = ih;
  if (iw / ih > target) sw = ih * target;
  else sh = iw / target;
  const sx = Math.max(0, Math.min(iw - sw, (iw - sw) * center[0]));
  const sy = Math.max(0, Math.min(ih - sh, (ih - sh) * center[1]));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export function roundRect(ctx: SKRSContext2D, x0: number, y0: number, x1: number, y1: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Darkened edges (approximation of the blurred-ellipse vignette). */
export function vignette(ctx: SKRSContext2D, strength = 120) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, H / W);
  const r = W * 0.62;
  const g = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.25);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength / 255})`);
  ctx.fillStyle = g;
  ctx.fillRect(-W, -W * 2, W * 2, W * 4);
  ctx.restore();
}

export function paw(ctx: SKRSContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const pr = Math.floor(r * 0.42);
  for (const [dx, dy] of [[-1.1, -1.25], [-0.1, -1.6], [1.1, -1.25]]) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function star(ctx: SKRSContext2D, cx: number, cy: number, r: number, color: string, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2 + (rot * Math.PI) / 180;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const px = cx + rad * Math.cos(ang), py = cy + rad * Math.sin(ang);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function snowflake(ctx: SKRSContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.strokeStyle = color;
  for (let a = 0; a < 360; a += 60) {
    const rad = (a * Math.PI) / 180;
    ctx.lineWidth = Math.max(2, Math.floor(r / 8));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
    ctx.stroke();
    const mx = cx + r * 0.6 * Math.cos(rad), my = cy + r * 0.6 * Math.sin(rad);
    ctx.lineWidth = Math.max(2, Math.floor(r / 10));
    for (const off of [-35, 35]) {
      const ar = ((a + off) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + r * 0.3 * Math.cos(ar), my + r * 0.3 * Math.sin(ar));
      ctx.stroke();
    }
  }
}

const blob = (ctx: SKRSContext2D, cx: number, cy: number, r: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
};

/** Theme decorations (confetti, snow, Chilean flag garland, sun, mountains). */
export function applyMotif(ctx: SKRSContext2D, style: Style, density: "full" | "light" = "full") {
  const a = style.accent, a2 = style.accent2;
  const rnd = rng(7);
  const full = density === "full";
  ctx.save();
  if (style.motif === "confetti") {
    const cols = [rgba(a, 235), rgba(a2, 235), rgba([255, 220, 120], 235)];
    const zone = full ? H : Math.floor(H * 0.26);
    for (let i = 0; i < (full ? 55 : 16); i++) {
      const x = rnd.randint(0, W), y = rnd.randint(0, zone), s = rnd.randint(8, 22);
      const c = rnd.choice(cols);
      ctx.fillStyle = c;
      if (rnd.random() < 0.5) {
        ctx.beginPath();
        ctx.ellipse(x + s / 2, y + s / 2, s / 2, s / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(x + s / 2, y + s / 4);
        ctx.rotate((-rnd.randint(0, 180) * Math.PI) / 180);
        ctx.fillRect(-s / 2, -s / 4, s, s * 0.5);
        ctx.restore();
      }
    }
  } else if (style.motif === "snow") {
    const zone = full ? H : Math.floor(H * 0.26);
    for (let i = 0; i < (full ? 45 : 14); i++) snowflake(ctx, rnd.randint(0, W), rnd.randint(0, zone), rnd.randint(10, 26), "rgba(255,255,255,0.7)");
    if (full) for (let i = 0; i < 8; i++) star(ctx, rnd.randint(0, W), rnd.randint(0, H), rnd.randint(8, 16), rgba(a2, 220));
  } else if (style.motif === "garland") {
    const cols = ["rgb(214,48,34)", "rgb(255,255,255)", "rgb(0,57,166)"];
    const y0 = full ? 150 : 90;
    ctx.strokeStyle = "rgba(255,255,255,0.63)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(W, y0 - 10);
    ctx.stroke();
    const step = 78;
    for (let i = 0, x = 10; x < W; i++, x += step) {
      ctx.fillStyle = cols[i % 3];
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + step - 14, y0);
      ctx.lineTo(x + (step - 14) / 2, y0 + 70);
      ctx.closePath();
      ctx.fill();
    }
    if (full) for (let i = 0; i < 10; i++) star(ctx, rnd.randint(0, W), rnd.randint(300, H - 200), rnd.randint(10, 22), rgba(a2, 200));
  } else if (style.motif === "sun") {
    const cx = W - 120, cy = 180;
    ctx.strokeStyle = "rgba(255,255,255,0.27)";
    ctx.lineWidth = 10;
    for (let d = 0; d < 360; d += 20) {
      const r = (d * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 260 * Math.cos(r), cy + 260 * Math.sin(r));
      ctx.stroke();
    }
    blob(ctx, cx, cy, 90, "rgba(255,240,180,0.9)");
    if (full) for (let i = 0; i < 12; i++) blob(ctx, rnd.randint(0, W), rnd.randint(0, H), rnd.randint(6, 14), "rgba(255,255,255,0.47)");
  } else if (style.motif === "mountains") {
    if (full) {
      ctx.fillStyle = "rgba(255,255,255,0.137)";
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W * 0.3, H * 0.55); ctx.lineTo(W * 0.6, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.11)";
      ctx.beginPath(); ctx.moveTo(W * 0.4, H); ctx.lineTo(W * 0.72, H * 0.62); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < (full ? 10 : 4); i++) star(ctx, rnd.randint(0, W), rnd.randint(0, Math.floor(H * 0.35)), rnd.randint(6, 12), "rgba(255,255,255,0.59)");
  }
  ctx.restore();
}

/**
 * Render `draw` on an offscreen canvas and return it rotated like PIL `rotate(deg, expand=True)`
 * (positive = counter-clockwise).
 */
export function rotated(w: number, h: number, deg: number, draw: (ctx: SKRSContext2D) => void): Canvas {
  const [src, sctx] = canvas(Math.ceil(w), Math.ceil(h));
  draw(sctx);
  const rad = (deg * Math.PI) / 180;
  const nw = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)));
  const nh = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)));
  const [out, octx] = canvas(nw, nh);
  octx.translate(nw / 2, nh / 2);
  octx.rotate(-rad);
  octx.drawImage(src, -w / 2, -h / 2);
  return out;
}

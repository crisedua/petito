import sharp, { type Sharp } from "sharp";
import * as storage from "./storage";

/** Decode any upload (incl. iPhone HEIC) into a sharp pipeline with EXIF rotation applied. */
async function decode(raw: Buffer): Promise<Sharp> {
  try {
    const s = sharp(raw, { failOn: "none" }).rotate();
    await s.metadata();
    return s;
  } catch {
    // Vercel's prebuilt sharp has no libheif; fall back to the wasm decoder for HEIC/HEIF.
    const heicConvert = (await import("heic-convert")).default;
    const jpeg = await heicConvert({ buffer: raw, format: "JPEG", quality: 0.92 });
    return sharp(Buffer.from(jpeg)).rotate();
  }
}

/** Port of storage.save_original: max 1536px, EXIF stripped, JPEG q88 → orig_{i}.jpg */
export async function saveOriginal(owner: string, index: number, raw: Buffer): Promise<string> {
  const img = await decode(raw);
  const out = await img.resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  const name = `orig_${index}.jpg`;
  await storage.put(owner, name, out, "image/jpeg");
  return name;
}

export async function loadImage(owner: string, name: string): Promise<Buffer> {
  return (await storage.get(owner, name)).buf;
}

/** Downscaled base64 (no data: prefix) for Claude vision. */
export async function imageToB64(owner: string, name: string, maxSide = 384): Promise<string> {
  const buf = await loadImage(owner, name);
  const out = await sharp(buf).resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return out.toString("base64");
}

export async function imageToDataUri(owner: string, name: string, maxSide = 1024): Promise<string> {
  const buf = await loadImage(owner, name);
  const out = await sharp(buf).resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

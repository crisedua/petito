/**
 * Sample images on the portrait style picker. Admins generate alternatives with the real portrait
 * pipeline (same prompt + frame a customer gets) from a reference pet photo, then choose which one
 * the app shows. Stored as stylesamples/{style}_{ts}.jpg plus stylesamples/catalog.json; styles
 * without a chosen sample keep the built-in /portrait-styles/{style}.jpg.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import * as storage from "./storage";
import * as fal from "./fal";
import { portraitPrompt } from "./prompts";
import { PORTRAIT_FRAMES, PORTRAIT_STYLES, STYLE_DEFAULT_FRAME, frameFor } from "@/lib/catalogs";

const OWNER = "stylesamples";
const FILE = "catalog.json";
const MAX_CANDIDATES = 6;

export type SampleEntry = { current: string | null; candidates: { name: string; frame: string; ref: string; created_at: string }[] };
export type SampleCatalog = Record<string, SampleEntry>;

export async function readCatalog(): Promise<SampleCatalog> {
  try {
    if (!(await storage.exists(OWNER, FILE))) return {};
    return JSON.parse((await storage.get(OWNER, FILE)).buf.toString("utf8"));
  } catch {
    return {};
  }
}
const writeCatalog = (c: SampleCatalog) => storage.put(OWNER, FILE, Buffer.from(JSON.stringify(c)), "application/octet-stream");

export const sampleUrl = (name: string) => storage.mediaPath(OWNER, name);

/** style → URL of the chosen sample (only styles that have one). */
export async function chosenSamples(): Promise<Record<string, string>> {
  const c = await readCatalog();
  return Object.fromEntries(Object.entries(c).filter(([, e]) => e.current).map(([k, e]) => [k, sampleUrl(e.current!)]));
}

/** Data URI of the reference photo: the built-in example dog, or a photo the caller already loaded. */
async function referenceDataUri(photo?: Buffer): Promise<string> {
  const buf = photo ?? (await readFile(path.join(process.cwd(), "assets", "sample-pets", "dog.jpg")));
  const jpg = await sharp(buf).rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

export async function generateCandidate(style: string, frame: string | null, ref: { label: string; photo?: Buffer }) {
  const def = PORTRAIT_STYLES[style];
  if (!def) throw new Error("Estilo inválido");
  const frameKey = frame && PORTRAIT_FRAMES[frame] ? frame : STYLE_DEFAULT_FRAME[style] ?? "dorado";
  const fr = frameFor(style, frameKey);
  const out = await fal.editImageNow(await referenceDataUri(ref.photo), portraitPrompt("mascota", `${def.prompt}, ${fr.prompt}`), "3:4");
  const small = await sharp(out).resize(600, 800, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
  const name = `${style}_${Date.now()}.jpg`;
  await storage.put(OWNER, name, small, "image/jpeg");
  const c = await readCatalog();
  const e: SampleEntry = c[style] ?? { current: null, candidates: [] };
  e.candidates.unshift({ name, frame: frameKey, ref: ref.label, created_at: new Date().toISOString() });
  const dropped = e.candidates.splice(MAX_CANDIDATES).map((x) => x.name).filter((n) => n !== e.current);
  c[style] = e;
  await writeCatalog(c);
  if (dropped.length) await storage.remove(OWNER, dropped).catch(() => {});
  return { name, url: sampleUrl(name), frame: frameKey };
}

/** Show this candidate on the style picker (null = back to the built-in sample). */
export async function chooseSample(style: string, name: string | null) {
  const c = await readCatalog();
  const e = c[style];
  if (!e) throw new Error("Sin alternativas para este estilo");
  if (name && !e.candidates.some((x) => x.name === name)) throw new Error("Esa alternativa no existe");
  e.current = name;
  await writeCatalog(c);
}

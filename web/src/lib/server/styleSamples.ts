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
import { photoEditPrompt, portraitPrompt } from "./prompts";
import { renderPhotoStyle } from "@/lib/render/photoStyles";
import { PORTRAIT_FRAMES, PORTRAIT_STYLES, STYLE_DEFAULT_FRAME, frameFor, styleMode } from "@/lib/catalogs";

const OWNER = "stylesamples";
const FILE = "catalog.json";
const MAX_CANDIDATES = 6;

export type SampleEntry = {
  current: string | null; // shown for the style in general
  byFrame?: Record<string, string>; // the sample shown for this style in each frame
  candidates: { name: string; frame: string; ref: string; created_at: string }[];
};
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

/** style → { default sample, sample per frame } (only what exists; the app falls back to built-ins). */
export async function chosenSamples(): Promise<Record<string, { default: string | null; frames: Record<string, string> }>> {
  const c = await readCatalog();
  const out: Record<string, { default: string | null; frames: Record<string, string> }> = {};
  for (const [k, e] of Object.entries(c)) {
    const frames = Object.fromEntries(Object.entries(e.byFrame ?? {}).map(([f, n]) => [f, sampleUrl(n)]));
    if (e.current || Object.keys(frames).length) out[k] = { default: e.current ? sampleUrl(e.current) : null, frames };
  }
  return out;
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
  const mode = styleMode(style);
  const frameKey = mode !== "paint" ? "sin_marco" : frame && PORTRAIT_FRAMES[frame] ? frame : STYLE_DEFAULT_FRAME[style] ?? "dorado";
  const fr = frameFor(style, frameKey);
  const photo = ref.photo ?? (await readFile(path.join(process.cwd(), "assets", "sample-pets", "dog.jpg")));
  const out = mode === "render"
    ? await renderPhotoStyle(style, photo, ref.label === "Perro de ejemplo" ? "Rocco" : ref.label)
    : await fal.editImageNow(await referenceDataUri(photo), mode === "edit" ? photoEditPrompt("mascota", def.prompt) : portraitPrompt("mascota", `${def.prompt}, ${fr.prompt}`), "3:4");
  const small = await sharp(out).resize(600, 800, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
  const name = `${style}_${Date.now()}.jpg`;
  await storage.put(OWNER, name, small, "image/jpeg");
  const c = await readCatalog();
  const e: SampleEntry = c[style] ?? { current: null, candidates: [] };
  e.candidates.unshift({ name, frame: frameKey, ref: ref.label, created_at: new Date().toISOString() });
  // First sample for this frame: show it right away for that frame.
  e.byFrame = e.byFrame ?? {};
  if (!e.byFrame[frameKey]) e.byFrame[frameKey] = name;
  const keep = new Set([e.current, ...Object.values(e.byFrame)].filter(Boolean));
  const extra = e.candidates.filter((x) => !keep.has(x.name));
  const dropNames = new Set(extra.slice(Math.max(0, MAX_CANDIDATES - keep.size)).map((x) => x.name));
  e.candidates = e.candidates.filter((x) => !dropNames.has(x.name));
  const dropped = [...dropNames];
  c[style] = e;
  await writeCatalog(c);
  if (dropped.length) await storage.remove(OWNER, dropped).catch(() => {});
  return { name, url: sampleUrl(name), frame: frameKey };
}

/** Show this candidate for its frame and as the style's main sample (null = back to the built-in sample). */
export async function chooseSample(style: string, name: string | null) {
  const c = await readCatalog();
  const e = c[style];
  if (!e) throw new Error("Sin alternativas para este estilo");
  const cand = name ? e.candidates.find((x) => x.name === name) : null;
  if (name && !cand) throw new Error("Esa alternativa no existe");
  e.current = name;
  if (cand) e.byFrame = { ...(e.byFrame ?? {}), [cand.frame]: cand.name };
  await writeCatalog(c);
}

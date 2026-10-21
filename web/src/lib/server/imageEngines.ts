/**
 * Image-edit engines for portraits ("keep this photo, change X"). The admin compares them in
 * Muestras and picks the default for everyone (stylesamples/settings.json); IMAGE_ENGINE env is the
 * fallback default. Every engine: photo(s) in → one 3:4 JPEG out.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import * as storage from "./storage";
import * as fal from "./fal";
import * as hf from "./higgsfield";
import { env } from "./env";

export type EngineKey = "nano_banana" | "nano_banana_pro" | "flux2" | "grok";
export type Engine = { key: EngineKey; label: string; provider: "fal" | "higgsfield"; model: string; costUsd: number; maxRefs: number; note: string };

export const IMAGE_ENGINES: Record<EngineKey, Engine> = {
  nano_banana: { key: "nano_banana", label: "Nano Banana (actual)", provider: "fal", model: "fal-ai/nano-banana/edit", costUsd: 0.039, maxRefs: 1, note: "El de siempre, 1K" },
  nano_banana_pro: { key: "nano_banana_pro", label: "Nano Banana Pro", provider: "fal", model: "fal-ai/nano-banana-pro/edit", costUsd: 0.15, maxRefs: 4, note: "Más fiel, hasta 2K" },
  flux2: { key: "flux2", label: "FLUX.2", provider: "fal", model: "fal-ai/flux-2/edit", costUsd: 0.05, maxRefs: 4, note: "Luz y pelaje muy naturales, 4 fotos de referencia" },
  grok: { key: "grok", label: "Grok Imagine 2.0 (Higgsfield)", provider: "higgsfield", model: "xai/grok-imagine-image-2.0", costUsd: 0.04, maxRefs: 4, note: "Ediciones precisas, 2K" },
};

const SETTINGS_OWNER = "stylesamples", SETTINGS_FILE = "settings.json";
let cache: { at: number; key: EngineKey } | null = null;

export async function defaultEngine(): Promise<Engine> {
  if (cache && Date.now() - cache.at < 60_000) return IMAGE_ENGINES[cache.key];
  let key = (process.env.IMAGE_ENGINE as EngineKey) || "nano_banana";
  try {
    if (await storage.exists(SETTINGS_OWNER, SETTINGS_FILE)) {
      const s = JSON.parse((await storage.get(SETTINGS_OWNER, SETTINGS_FILE)).buf.toString("utf8"));
      if (s.image_engine && IMAGE_ENGINES[s.image_engine as EngineKey]) key = s.image_engine;
    }
  } catch { /* keep env default */ }
  if (!IMAGE_ENGINES[key]) key = "nano_banana";
  cache = { at: Date.now(), key };
  return IMAGE_ENGINES[key];
}

export async function setDefaultEngine(key: EngineKey) {
  if (!IMAGE_ENGINES[key]) throw new Error("Motor desconocido");
  await storage.put(SETTINGS_OWNER, SETTINGS_FILE, Buffer.from(JSON.stringify({ image_engine: key })), "application/octet-stream");
  cache = { at: Date.now(), key };
}

/**
 * Engine for everything meant to look like a real photo (photo-edit portraits, story scenes). Nano Banana
 * Pro keeps the pet's real face and fur best and renders at 2K, so it is the default; PHOTO_IMAGE_ENGINE
 * can switch to another fal engine. Paintings keep using the admin's default engine.
 */
export function photoEngine(): Engine {
  const key = process.env.PHOTO_IMAGE_ENGINE as EngineKey;
  const e = IMAGE_ENGINES[key] ?? IMAGE_ENGINES.nano_banana_pro;
  return e.provider === "fal" ? e : IMAGE_ENGINES.nano_banana_pro;
}

export const engineAvailable = (e: Engine) => env.mockAi || (e.provider === "fal" ? Boolean(env.falKey) : hf.higgsfieldEnabled());

const toDataUri = async (buf: Buffer) =>
  `data:image/jpeg;base64,${(await sharp(buf).rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`;

/** Submit an edit; the first image is the photo to keep, the rest are extra references of the same pet. */
export async function submitEditWith(engine: Engine, images: Buffer[], prompt: string, aspect: "3:4" | "9:16" = "3:4"): Promise<{ provider: "fal" | "higgsfield"; id: string; model: string }> {
  const refs = images.slice(0, Math.max(1, engine.maxRefs));
  if (engine.provider === "fal") {
    const urls = await Promise.all(refs.map(toDataUri));
    const input: Record<string, unknown> = engine.key === "flux2"
      ? { image_urls: urls, prompt, image_size: aspect === "9:16" ? { width: 864, height: 1536 } : { width: 1152, height: 1536 }, output_format: "jpeg" }
      : { image_urls: urls, prompt, num_images: 1, output_format: "jpeg", aspect_ratio: aspect, ...(engine.key === "nano_banana_pro" ? { resolution: "2K" } : {}) };
    return { provider: "fal", id: await fal.submitRaw(engine.model, input), model: engine.model };
  }
  if (env.mockAi) return { provider: "higgsfield", id: `mock-hf-img-${randomUUID()}`, model: engine.model };
  const urls = await Promise.all(refs.map((b) => hf.uploadImage(b)));
  return { provider: "higgsfield", id: await hf.submitRaw(engine.model, { prompt, image_urls: urls, aspect_ratio: aspect, resolution: "2k", quality: "medium" }), model: engine.model };
}

/** Wait for the edit in the same request (admin samples; ~10–60 s). Returns JPEG bytes. */
export async function editImageNow(engine: Engine, images: Buffer[], prompt: string, maxMs = 55_000): Promise<Buffer> {
  if (env.mockAi) {
    // Echo the photo with a tint so the pipeline has a real JPEG (same as the fal mock).
    return sharp(images[0]).tint({ r: 230, g: 190, b: 150 }).jpeg({ quality: 90 }).toBuffer();
  }
  const sub = await submitEditWith(engine, images, prompt);
  const end = Date.now() + maxMs;
  for (;;) {
    if (sub.provider === "fal") {
      const st = await fal.status(sub.model, sub.id);
      if (st === "COMPLETED") return fal.download(await fal.resultUrl(sub.model, sub.id));
      if (st === "FAILED") throw new Error(`${engine.label} no pudo generar la imagen`);
    } else {
      const st = await hf.status(sub.id);
      if (st.state === "COMPLETED") return hf.download(st.url!);
      if (st.state === "FAILED") throw new Error(`${engine.label}: ${st.error ?? "falló"}`);
    }
    if (Date.now() > end) throw new Error(`${engine.label} tardó demasiado; inténtalo de nuevo`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

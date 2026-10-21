/**
 * fal.ai queue API (direct, with our own FAL_KEY). Requests are submitted with a webhook URL; the
 * webhook only wakes the waiting job, which then reads status/result from fal itself, so webhook
 * payloads never need to be trusted.
 */
import { createFalClient } from "@fal-ai/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "./env";

export const FAL_IMG_COST = 0.039; // USD per generated image (estimate)
export const FAL_VIDEO_COST_PER_SEC = 0.1333;

let client: ReturnType<typeof createFalClient> | null = null;
const fal = () => (client ??= createFalClient({ credentials: env.falKey }));

/**
 * Where fal reports completion (a lost webhook costs up to 15 s per video). Vercel's own production
 * hostname is preferred, with the "Protection Bypass for Automation" secret appended when deployment
 * protection is on, since fal can't log in to Vercel. Otherwise PUBLIC_BASE_URL is used.
 */
const webhookUrl = () => {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (vercel && bypass) return `https://${vercel}/api/webhooks/fal?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  const base = env.publicBaseUrl || (vercel ? `https://${vercel}` : "");
  return base ? `${base.replace(/\/$/, "")}/api/webhooks/fal` : undefined;
};

/** fal's own explanation (e.g. "User is locked. Reason: Exhausted balance"), so the failure says what to fix. */
function falReason(status: number, e: any): string {
  const body = e?.body ?? e?.response?.body;
  const detail = typeof body === "string" ? body : body?.detail ?? body?.message ?? e?.message ?? "";
  const text = String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 200);
  if (status === 402 || /balance|locked|credit|billing/i.test(text)) return `fal.ai: la cuenta no tiene saldo o está bloqueada (${status}). Recarga en fal.ai/dashboard/billing. ${text}`.trim();
  return `fal.ai rechazó la FAL_KEY (${status}). ${text}`.trim();
}

/** A configuration/input problem that retrying won't fix (missing/invalid key, no credit, bad input). */
export class PermanentFalError extends Error {}

// MOCK_AI: request ids that encode the input so "results" can be produced locally.
const mockInputs = new Map<string, unknown>();

async function submit(endpoint: string, input: Record<string, unknown>): Promise<string> {
  if (env.mockAi) {
    const id = `mock-${Math.random().toString(36).slice(2)}`;
    mockInputs.set(id, input);
    return id;
  }
  if (!env.falKey) throw new PermanentFalError("FAL_KEY no está configurada");
  try {
    const res = await fal().queue.submit(endpoint as any, { input: input as any, webhookUrl: webhookUrl() });
    return res.request_id;
  } catch (e: any) {
    const st = Number(e?.status ?? 0);
    if (st === 401 || st === 402 || st === 403) throw new PermanentFalError(falReason(st, e));
    if (st >= 400 && st < 500 && st !== 408 && st !== 429) throw new PermanentFalError(`fal.ai ${st}: ${String(e?.message ?? e).slice(0, 300)}`);
    throw e;
  }
}

/** Submit any fal queue endpoint with a prepared input (image engines). */
export const submitRaw = (endpoint: string, input: Record<string, unknown>) => submit(endpoint, input);

/** nano-banana/edit: image (data URI) + prompt → one JPEG. */
export const submitEdit = (imageDataUri: string, prompt: string, aspectRatio: "9:16" | "3:4") =>
  submit(env.falImageModel, { image_urls: [imageDataUri], prompt, num_images: 1, output_format: "jpeg", aspect_ratio: aspectRatio });

/**
 * Talking-video lip-sync: photo + voice → MP4 (duration follows the audio). Inputs are uploaded to
 * fal's own storage first, so this works no matter where the app is hosted. VEED Fabric models take a
 * resolution; the older sync-lipsync model doesn't.
 */
export async function submitLipsync(imageJpeg: Buffer, audioMp3: Buffer, hd: boolean): Promise<{ requestId: string; model: string }> {
  const model = hd ? env.falLipsyncHdModel : env.falLipsyncModel;
  if (env.mockAi) return { requestId: await submit(model, {}), model };
  if (!env.falKey) throw new PermanentFalError("FAL_KEY no está configurada");
  let imageUrl: string, audioUrl: string;
  try {
    [imageUrl, audioUrl] = await Promise.all([
      fal().storage.upload(new Blob([new Uint8Array(imageJpeg)], { type: "image/jpeg" })),
      fal().storage.upload(new Blob([new Uint8Array(audioMp3)], { type: "audio/mpeg" })),
    ]);
  } catch (e: any) {
    const st = Number(e?.status ?? 0);
    if (st === 401 || st === 403 || st === 402) throw new PermanentFalError(falReason(st, e));
    throw e;
  }
  const input: Record<string, unknown> = { image_url: imageUrl, audio_url: audioUrl };
  if (model.includes("fabric")) input.resolution = hd ? "720p" : "480p";
  return { requestId: await submit(model, input), model };
}

export type FalState = "PENDING" | "COMPLETED" | "FAILED";

export async function status(endpoint: string, requestId: string): Promise<FalState> {
  if (env.mockAi) return "COMPLETED";
  const st = await fal().queue.status(endpoint, { requestId, logs: false });
  const s = String((st as { status?: string }).status ?? "").toUpperCase();
  if (s === "COMPLETED" || s === "OK") return "COMPLETED";
  if (["FAILED", "CANCELLED", "CANCELED", "ERROR"].includes(s)) return "FAILED";
  return "PENDING";
}

/** URL of the produced asset (image or video). */
export async function resultUrl(endpoint: string, requestId: string): Promise<string> {
  if (env.mockAi) return `mock:${requestId}`;
  const res = await fal().queue.result(endpoint as any, { requestId });
  const data = res.data as { images?: Array<{ url: string } | string>; video?: { url: string } | string };
  if (data.images?.length) return typeof data.images[0] === "string" ? data.images[0] : data.images[0].url;
  if (data.video) return typeof data.video === "string" ? data.video : data.video.url;
  throw new Error("fal returned no output");
}

export async function download(url: string): Promise<Buffer> {
  if (url.startsWith("mock:")) {
    const input = mockInputs.get(url.slice(5)) as Record<string, any> | undefined;
    if (input?.image_urls) {
      // Echo the input image with a warm tint so the pipeline has a real JPEG to work with.
      const b64 = String(input.image_urls[0]).split(",")[1] ?? "";
      return sharp(Buffer.from(b64, "base64")).tint({ r: 230, g: 190, b: 150 }).jpeg({ quality: 90 }).toBuffer();
    }
    return readFile(path.join(process.cwd(), "assets", "mock", "talk.mp4"));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * One image edit, waited for in the same request (admin sample generator; ~10–30 s). Polls fal's
 * queue instead of waiting for the webhook. Returns JPEG bytes.
 */
export async function editImageNow(imageDataUri: string, prompt: string, aspectRatio: "9:16" | "3:4", maxMs = 55_000): Promise<Buffer> {
  const requestId = await submitEdit(imageDataUri, prompt, aspectRatio);
  const end = Date.now() + maxMs;
  for (;;) {
    const st = await status(env.falImageModel, requestId);
    if (st === "COMPLETED") return download(await resultUrl(env.falImageModel, requestId));
    if (st === "FAILED") throw new Error("fal.ai no pudo generar la imagen");
    if (Date.now() > end) throw new Error("fal.ai tardó demasiado; inténtalo de nuevo");
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export const FAL_MOTION_MODEL = process.env.FAL_MOTION_MODEL ?? "fal-ai/kling-video/o1/reference-to-video";
export const FAL_MOTION_COST_PER_SEC = Number(process.env.FAL_MOTION_COST_PER_SEC ?? "0.112");

/**
 * Short clip of the real pet doing something (Kling O1 reference-to-video): the photo goes in as an
 * element so the same animal, fur and markings carry through the whole clip.
 */
export async function submitMotion(imageJpeg: Buffer, scenePrompt: string, seconds: number): Promise<string> {
  const prompt =
    `@Element1 is this exact pet: keep the very same animal, breed, fur colors, markings and face throughout. ` +
    `Realistic video of @Element1 ${scenePrompt}. Natural movement, the pet stays the clear subject, ` +
    `vertical 9:16 framing, steady camera, no text, no watermark.`;
  if (env.mockAi) return submit(FAL_MOTION_MODEL, { prompt });
  if (!env.falKey) throw new PermanentFalError("FAL_KEY no está configurada");
  let imageUrl: string;
  try {
    imageUrl = await fal().storage.upload(new Blob([new Uint8Array(imageJpeg)], { type: "image/jpeg" }));
  } catch (e: any) {
    const st = Number(e?.status ?? 0);
    if (st === 401 || st === 403 || st === 402) throw new PermanentFalError(falReason(st, e));
    throw e;
  }
  return submit(FAL_MOTION_MODEL, { prompt, elements: [{ frontal_image_url: imageUrl }], duration: String(seconds), aspect_ratio: "9:16" });
}

/** Cheap check that fal accepts our key (uploads 1 byte to fal storage; no generation, no cost). */
export async function falKeyCheck(): Promise<{ ok: boolean; status?: number; reason?: string }> {
  if (!env.falKey) return { ok: false, reason: "FAL_KEY no está configurada" };
  try {
    await fal().storage.upload(new Blob([new Uint8Array([0])], { type: "application/octet-stream" }));
    return { ok: true };
  } catch (e: any) {
    const st = Number(e?.status ?? 0) || undefined;
    return { ok: false, status: st, reason: falReason(st ?? 0, e) };
  }
}

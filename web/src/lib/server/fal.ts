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

const webhookUrl = () => (env.publicBaseUrl ? `${env.publicBaseUrl}/api/webhooks/fal` : undefined);

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
    if (st >= 400 && st < 500 && st !== 408 && st !== 429) throw new PermanentFalError(`fal.ai ${st}: ${String(e?.message ?? e).slice(0, 300)}`);
    throw e;
  }
}

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
    if (st === 401 || st === 403) throw new PermanentFalError(`fal.ai rechazó la FAL_KEY (${st})`);
    if (st === 402) throw new PermanentFalError("fal.ai: sin saldo en la cuenta (402)");
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

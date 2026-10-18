/**
 * ElevenLabs Image & Video API, lip-sync model (`creatify-aurora`): photo + speech audio → MP4.
 * Inputs are sent inline, so no public media URL is needed. Requires an ElevenLabs Pro plan or
 * above and an API key with the Image & Video permission. Results are polled (≥10 s apart).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

const API = "https://api.elevenlabs.io/v1/flows/video";
export const ELEVEN_VIDEO_MODEL = "creatify-aurora";

export type VideoState = { state: "PENDING" | "COMPLETED" | "FAILED"; url?: string; error?: string };

/** A configuration/plan problem that retrying won't fix (bad key, plan too low, missing permission, bad input). */
export class PermanentVideoError extends Error {}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "xi-api-key": env.elevenKey, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    if (res.status === 402) throw new PermanentVideoError(`ElevenLabs: el video requiere plan Pro o superior (${text})`);
    if (text.includes("invalid_api_key")) throw new PermanentVideoError("ElevenLabs: la API key no es válida");
    if (res.status === 401 || res.status === 403) throw new PermanentVideoError(`ElevenLabs: la API key no tiene permiso de Image & Video (${res.status}: ${text})`);
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) throw new PermanentVideoError(`ElevenLabs video ${res.status}: ${text}`);
    throw new Error(`ElevenLabs video ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Start a lip-sync generation. Returns the generation id. */
export async function submitLipsync(imageJpeg: Buffer, audioMp3: Buffer, resolution: "480p" | "720p"): Promise<string> {
  if (env.mockAi) return `mock-eleven-${Math.random().toString(36).slice(2)}`;
  const d = await call<{ id: string; status: string }>("POST", API, {
    model_id: ELEVEN_VIDEO_MODEL,
    resolution,
    image: { type: "inline_base64", content_base64: imageJpeg.toString("base64"), mime_type: "image/jpeg" },
    audio: { type: "inline_base64", content_base64: audioMp3.toString("base64"), mime_type: "audio/mpeg" },
  });
  return d.id;
}

export async function status(id: string): Promise<VideoState> {
  if (env.mockAi) return { state: "COMPLETED", url: `mock:${id}` };
  const d = await call<{ status: string; content_url?: string; error_message?: string; failure_reason?: string }>("GET", `${API}/${id}`);
  if (d.status === "completed" && d.content_url) return { state: "COMPLETED", url: d.content_url };
  if (d.status === "failed") return { state: "FAILED", error: `${d.failure_reason ?? "failed"}: ${d.error_message ?? ""}` };
  return { state: "PENDING" };
}

export async function download(url: string): Promise<Buffer> {
  if (url.startsWith("mock:")) return readFile(path.join(process.cwd(), "assets", "mock", "talk.mp4"));
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

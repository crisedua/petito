/**
 * Higgsfield API (docs.higgsfield.ai): used for "Tu mascota en movimiento" (Seedance 2.5
 * reference-to-video). Async: upload the photo → submit → poll /requests/{id}/status.
 * Credentials: HIGGSFIELD_KEY_ID + HIGGSFIELD_KEY_SECRET, or HIGGSFIELD_API_KEY="id:secret".
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

const BASE = "https://api.higgsfield.ai";
export const HF_MOTION_MODEL = process.env.HIGGSFIELD_MOTION_MODEL ?? "bytedance/seedance-2.5/reference-to-video";
/** From open.higgsfield.ai list price ("from 0.144 / s"); used only for the admin cost panel. */
export const HF_MOTION_COST_PER_SEC = Number(process.env.HIGGSFIELD_MOTION_COST_PER_SEC ?? "0.144");
export const HF_T2V_MODEL = process.env.HIGGSFIELD_T2V_MODEL ?? "bytedance/seedance-2.5/text-to-video";
export const HF_GENJUTSU_MODEL = process.env.HIGGSFIELD_GENJUTSU_MODEL ?? "higgsfield/genjutsu/motion-transfer/v1.0";
/** Genjutsu's price isn't on its API page; "from 0.025/s" is the Light list price. Admin-panel estimate only. */
export const HF_GENJUTSU_COST_PER_SEC = Number(process.env.HIGGSFIELD_GENJUTSU_COST_PER_SEC ?? "0.05");

/** A problem retrying won't fix: missing/refused key, no balance, rejected input. */
export class PermanentHiggsfieldError extends Error {}

const first = (...names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean) || "";

export function higgsfieldCredentials(): string | null {
  // Accept the names people commonly use (and the legacy hf-api-key / hf-secret pair from Higgsfield's docs).
  const id = first("HIGGSFIELD_KEY_ID", "HIGGSFIELD_API_KEY_ID", "HF_API_KEY_ID", "HF_KEY_ID", "HIGGSFIELD_ID", "HF_API_KEY", "HIGGSFIELD_KEY", "HIGGSFIELD_API_KEY");
  const secret = first("HIGGSFIELD_KEY_SECRET", "HIGGSFIELD_API_KEY_SECRET", "HIGGSFIELD_SECRET", "HIGGSFIELD_API_SECRET", "HF_API_KEY_SECRET", "HF_API_SECRET", "HF_SECRET", "HF_KEY_SECRET");
  if (id.includes(":")) return id; // "id:secret" in one variable
  if (id && secret) return `${id}:${secret}`;
  return null;
}

/** Names (never values) of Higgsfield-looking env vars, to diagnose a missing key. */
export const higgsfieldEnvNames = () =>
  Object.keys(process.env).filter((k) => /higgs|^hf_/i.test(k)).sort();
export const higgsfieldEnabled = () => Boolean(higgsfieldCredentials()) || env.mockAi;

async function call<T = any>(method: string, url: string, body?: unknown, idempotent = false): Promise<T> {
  const creds = higgsfieldCredentials();
  if (!creds) throw new PermanentHiggsfieldError("Higgsfield no está configurado (HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET)");
  const res = await fetch(url.startsWith("http") ? url : `${BASE}${url}`, {
    method,
    headers: {
      Authorization: `Key ${creds}`,
      "Content-Type": "application/json",
      ...(idempotent ? { "Idempotency-Key": randomUUID() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    const msg = `Higgsfield ${res.status}: ${text.slice(0, 240)}`;
    if ([400, 401, 402, 403, 404, 422].includes(res.status)) throw new PermanentHiggsfieldError(msg);
    throw new Error(msg);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Upload bytes through a presigned URL; returns the public URL to pass as an input. */
export async function uploadImage(jpeg: Buffer): Promise<string> {
  const up = await call<{ public_url: string; upload_url: string; upload_headers?: Record<string, string> }>(
    "POST", "/files/generate-upload-url", { content_type: "image/jpeg" });
  const put = await fetch(up.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg", ...(up.upload_headers ?? {}) },
    body: new Uint8Array(jpeg),
    signal: AbortSignal.timeout(60_000),
  });
  if (!put.ok) throw new Error(`Higgsfield upload ${put.status}`);
  return up.public_url;
}

/** The real pet (from its photo) in a short vertical scene, with generated sound. Returns request_id. */
export async function submitMotion(images: Buffer[], scenePrompt: string, seconds: number, identity = ""): Promise<string> {
  if (env.mockAi) return `mock-hf-${randomUUID()}`;
  const imageUrls = await Promise.all(images.slice(0, 6).map(uploadImage));
  const prompt =
    `The pet shown in the reference images (${identity || "the same animal in every reference"}): keep exactly the same animal, ` +
    `breed, fur colors, markings, eyes and face in every frame, ${scenePrompt}. Realistic video, natural movement, ` +
    `the pet is always the clear subject, steady camera, no text.`;
  const r = await call<{ request_id: string }>("POST", `/${HF_MOTION_MODEL}`, {
    prompt, image_urls: imageUrls, duration: Math.max(4, Math.min(30, seconds)), resolution: "720p",
    aspect_ratio: "9:16", generate_audio: true,
  }, true);
  if (!r.request_id) throw new Error("Higgsfield did not return a request_id");
  return r.request_id;
}

export type HfState = { state: "PENDING" | "COMPLETED" | "FAILED"; url?: string; error?: string };

export async function status(requestId: string): Promise<HfState> {
  if (requestId.startsWith("mock-hf-")) return { state: "COMPLETED", url: "mock:higgsfield" };
  const s = await call<{ status: string; video?: { url?: string }; error?: unknown }>("GET", `/requests/${requestId}/status`);
  if (s.status === "completed") return s.video?.url ? { state: "COMPLETED", url: s.video.url } : { state: "FAILED", error: "sin video en la respuesta" };
  if (["failed", "nsfw", "canceled"].includes(s.status)) return { state: "FAILED", error: `${s.status}${s.error ? `: ${JSON.stringify(s.error).slice(0, 200)}` : ""}` };
  return { state: "PENDING" };
}

export async function download(url: string): Promise<Buffer> {
  if (url === "mock:higgsfield") return readFile(path.join(process.cwd(), "assets", "mock", "talk.mp4"));
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Higgsfield download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Cheap credential check (asks for an upload URL; nothing is generated or charged). */
export async function keyCheck(): Promise<{ ok: boolean; reason?: string }> {
  if (!higgsfieldCredentials()) {
    const names = higgsfieldEnvNames();
    const single = process.env.HIGGSFIELD_API_KEY?.trim();
    if (single && !single.includes(":")) return { ok: false, reason: "HIGGSFIELD_API_KEY debe tener las dos partes de la clave unidas con dos puntos: keyid:secret (o usa HIGGSFIELD_KEY_ID + HIGGSFIELD_KEY_SECRET)" };
    return { ok: false, reason: names.length
      ? `Encontré estas variables pero falta el ID o el secreto: ${names.join(", ")}`
      : "Higgsfield no está configurado: no hay variables HIGGSFIELD_* en este deploy (¿falta redeploy?)" };
  }
  try {
    await call("POST", "/files/generate-upload-url", { content_type: "image/jpeg" });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: String(e?.message ?? e).slice(0, 300) };
  }
}

/** A short clip from text (used once per dance to make the choreography source video). Returns request_id. */
export async function submitTextToVideo(prompt: string, seconds: number, aspectRatio = "9:16"): Promise<string> {
  if (env.mockAi) return `mock-hf-${randomUUID()}`;
  const r = await call<{ request_id: string }>("POST", `/${HF_T2V_MODEL}`, {
    prompt, duration: Math.max(4, Math.min(30, seconds)), resolution: "720p", aspect_ratio: aspectRatio, generate_audio: true,
  }, true);
  if (!r.request_id) throw new Error("Higgsfield did not return a request_id");
  return r.request_id;
}

/** Genjutsu motion transfer: the pet (reference image) performs the moves of `videoUrl`. Returns request_id. */
export async function submitMotionTransfer(videoUrl: string, images: Buffer[], prompt: string, identity = ""): Promise<string> {
  if (env.mockAi) return `mock-hf-${randomUUID()}`;
  const imageUrls = await Promise.all(images.slice(0, 8).map(uploadImage));
  const r = await call<{ request_id: string }>("POST", `/${HF_GENJUTSU_MODEL}`, {
    video_url: videoUrl, image_urls: imageUrls, resolution: "720p",
    prompt: `Replace the dancer with the pet from the reference images (${identity || "the same animal in every reference"}): keep exactly the same animal, breed, fur colors, markings, eyes and face, ${prompt}. Keep the dancer's motion, timing and camera; realistic, no text.`,
  }, true);
  if (!r.request_id) throw new Error("Higgsfield did not return a request_id");
  return r.request_id;
}

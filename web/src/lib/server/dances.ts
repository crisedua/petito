/**
 * Choreography library for "Tu mascota en movimiento": one source video per dance, generated once
 * with Seedance (a dancer performing it) and kept in storage under dances/{key}.mp4. Genjutsu then
 * transfers those moves onto each pet. The catalog (dances/catalog.json) tracks pending generations.
 */
import * as storage from "./storage";
import * as hf from "./higgsfield";
import { env } from "./env";
import { DANCE_SECONDS, MOTION_SCENES } from "@/lib/catalogs";

const OWNER = "dances";
const FILE = "catalog.json";
export type DanceEntry = { file?: string; created_at?: string; pending?: { request_id: string; started_at: string }; error?: string };
export type DanceCatalog = Record<string, DanceEntry>;

export async function readDances(): Promise<DanceCatalog> {
  try {
    if (!(await storage.exists(OWNER, FILE))) return {};
    return JSON.parse((await storage.get(OWNER, FILE)).buf.toString("utf8"));
  } catch {
    return {};
  }
}
const write = (c: DanceCatalog) => storage.put(OWNER, FILE, Buffer.from(JSON.stringify(c)), "application/octet-stream");

/** Absolute, public URL of a stored file (Higgsfield downloads the source video from here). */
export function publicUrl(name: string) {
  const base = env.publicBaseUrl || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.petipop.pro");
  return storage.publicMediaUrl(OWNER, name, base);
}

/** The ready source video for a dance, or null (then the job falls back to reference-to-video). */
export async function danceSourceUrl(key: string): Promise<string | null> {
  const e = (await readDances())[key];
  return e?.file ? publicUrl(e.file) : null;
}

/** Start generating the choreography for a dance (admin). Replaces any previous one when done. */
export async function startDance(key: string) {
  const scene = MOTION_SCENES[key];
  if (!scene?.choreo) throw new Error("Ese baile no existe");
  const c = await readDances();
  const requestId = await hf.submitTextToVideo(
    `${scene.choreo}. Vertical 9:16 video, the whole body of the dancer visible at all times, no cuts, no text, no watermark.`, DANCE_SECONDS, "9:16");
  c[key] = { ...(c[key] ?? {}), pending: { request_id: requestId, started_at: new Date().toISOString() }, error: undefined };
  await write(c);
  return c[key];
}

/** Check pending generations; when one is done, store the video and mark it ready. */
export async function refreshDances(): Promise<DanceCatalog> {
  const c = await readDances();
  let changed = false;
  for (const [key, e] of Object.entries(c)) {
    if (!e.pending) continue;
    try {
      const st = await hf.status(e.pending.request_id);
      if (st.state === "COMPLETED" && st.url) {
        const name = `${key}_${Date.now()}.mp4`;
        await storage.put(OWNER, name, await hf.download(st.url), "video/mp4");
        const old = e.file;
        c[key] = { file: name, created_at: new Date().toISOString() };
        if (old) await storage.remove(OWNER, [old]).catch(() => {});
        changed = true;
      } else if (st.state === "FAILED") {
        c[key] = { file: e.file, created_at: e.created_at, error: st.error ?? "falló" };
        changed = true;
      } else if (Date.now() - new Date(e.pending.started_at).getTime() > 20 * 60_000) {
        c[key] = { file: e.file, created_at: e.created_at, error: "tardó demasiado" };
        changed = true;
      }
    } catch (err: any) {
      c[key] = { file: e.file, created_at: e.created_at, error: String(err?.message ?? err).slice(0, 200) };
      changed = true;
    }
  }
  if (changed) await write(c);
  return c;
}

export const danceUrlPath = (name: string) => storage.mediaPath(OWNER, name);

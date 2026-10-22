/**
 * Chilean + neutral Latin American Spanish voices, picked once from the ElevenLabs voice library with
 * the server's own key, added to the account, and saved as voicesamples/catalog.json. The in-memory
 * copy backs voices() in elevenlabs.ts. ELEVENLABS_VOICES (if set) still wins.
 */
import { env } from "./env";
import * as storage from "./storage";
import type { Voice } from "@/lib/catalogs";

export type LibraryVoice = Voice & { accent: string; gender: string; name: string; preview_url?: string };

const OWNER = "voicesamples";
const FILE = "catalog.json";
const XI = "https://api.elevenlabs.io";

let cache: { at: number; list: LibraryVoice[] | null } | null = null;
export const cachedLibraryVoices = () => cache?.list ?? null;

/** Load the saved catalog into memory (re-read every 5 minutes). Cheap; call at the start of voice-using routes. */
export async function loadLibraryVoices(): Promise<LibraryVoice[] | null> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.list;
  let list: LibraryVoice[] | null = null;
  try {
    if (await storage.exists(OWNER, FILE)) list = JSON.parse((await storage.get(OWNER, FILE)).buf.toString("utf8"));
  } catch (e) {
    console.error("voice catalog unreadable", e);
  }
  cache = { at: Date.now(), list: list?.length ? list : null };
  return cache.list;
}

async function xi(path: string, init: RequestInit = {}) {
  const r = await fetch(`${XI}${path}`, { ...init, headers: { "xi-api-key": env.elevenKey, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

type Shared = { voice_id: string; public_owner_id: string; name: string; accent?: string; gender?: string; use_case?: string; cloned_by_count?: number; usage_character_count_1y?: number; preview_url?: string; language?: string };

async function shared(params: Record<string, string>): Promise<Shared[]> {
  const q = new URLSearchParams({ language: "es", page_size: "100", sort: "usage_character_count_1y", ...params });
  return ((await xi(`/v1/shared-voices?${q}`)).voices ?? []) as Shared[];
}

const GOOD_USE = /conversational|characters|social|narrat|entertain|informative/i;
const score = (v: Shared) => (v.cloned_by_count ?? 0) + (v.usage_character_count_1y ?? 0) / 10_000 + (GOOD_USE.test(v.use_case ?? "") ? 1e6 : 0);

/** Search, add to the account and save. Returns what was saved plus notes on anything that failed. */
export async function setupLibraryVoices(): Promise<{ voices: LibraryVoice[]; notes: string[] }> {
  if (!env.elevenKey) throw new Error("ELEVENLABS_API_KEY no está configurada");
  const notes: string[] = [];
  const pool = new Map<string, Shared>();
  const add = (list: Shared[]) => list.forEach((v) => v.language !== "en" && pool.set(v.voice_id, v));
  for (const accent of ["chilean", "latin american", "neutral"]) {
    try { add(await shared({ accent })); } catch (e: any) { notes.push(`search ${accent}: ${e.message}`); }
  }
  try { add(await shared({})); } catch (e: any) { notes.push(`search es: ${e.message}`); }
  const all = [...pool.values()];
  const isChile = (v: Shared) => /chile/i.test(v.accent ?? "") || /chilen|chilean/i.test(v.name);
  const isNeutral = (v: Shared) => !isChile(v) && /latin|neutral|mexic|colomb/i.test(v.accent ?? "");

  // Account voices, so a voice already added isn't added twice.
  const mine: any[] = (await xi("/v2/voices?page_size=100").catch(() => ({ voices: [] }))).voices ?? [];
  const inAccount = (v: Shared) => mine.find((m) => m.voice_id === v.voice_id || m.sharing?.original_voice_id === v.voice_id)?.voice_id as string | undefined;

  const slots: { label: string; match: (v: Shared) => boolean; gender: string }[] = [
    { label: "Chilena", match: isChile, gender: "female" },
    { label: "Chileno", match: isChile, gender: "male" },
    { label: "Latina neutra", match: isNeutral, gender: "female" },
    { label: "Latino neutro", match: isNeutral, gender: "male" },
  ];
  const picked: LibraryVoice[] = [];
  for (const slot of slots) {
    const cands = all.filter((v) => slot.match(v) && (v.gender ?? "").toLowerCase() === slot.gender && !picked.some((p) => p.name === v.name))
      .sort((a, b) => score(b) - score(a)).slice(0, 5);
    let done = false;
    for (const c of cands) {
      try {
        let id = inAccount(c);
        if (!id) id = (await xi(`/v1/voices/add/${c.public_owner_id}/${c.voice_id}`, { method: "POST", body: JSON.stringify({ new_name: `Petipo ${slot.label} – ${c.name}`.slice(0, 80) }) })).voice_id as string;
        picked.push({ id, label: slot.label, accent: c.accent ?? "", gender: slot.gender, name: c.name, preview_url: c.preview_url });
        done = true;
        break;
      } catch (e: any) {
        notes.push(`${slot.label} ${c.name}: ${e.message}`);
      }
    }
    if (!done) notes.push(`${slot.label}: no voice found (${cands.length} candidates)`);
  }
  if (picked.length) {
    await storage.put(OWNER, FILE, Buffer.from(JSON.stringify(picked)), "application/octet-stream");
    cache = { at: Date.now(), list: picked };
  }
  return { voices: picked, notes };
}

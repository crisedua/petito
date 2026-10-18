/**
 * Step 3: copy media files from the legacy object storage (Emergent) into Supabase Storage.
 * Object names are derived from the loaded rows. Resumable (out/copied.json), 404s → out/missing.json.
 * Needs INTEGRATION_PROXY_URL + EMERGENT_LLM_KEY from the old deployment while they still work.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { OUT, need, supabase } from "./shared";

const sb = supabase();
const LEGACY = need("INTEGRATION_PROXY_URL").replace(/\/$/, "") + "/objstore/api/v1/storage";
const VOICES = ["G5fUGgDJhRU7jqXTv65B", "4q0PbHS9CvGUVibwij58", "nYm4p0R8BhHFRBH8wGHm", "fZfhCzqImeCHqeFIpNOv"];
const copiedFile = path.join(OUT, "copied.json");
const copied = new Set<string>(existsSync(copiedFile) ? JSON.parse(readFileSync(copiedFile, "utf8")) : []);
const missing: string[] = [];

async function legacyKey(): Promise<string> {
  const r = await fetch(`${LEGACY}/init`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emergent_key: need("EMERGENT_LLM_KEY") }) });
  if (!r.ok) throw new Error(`legacy storage init ${r.status}`);
  return (await r.json()).storage_key;
}

async function all<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

(async () => {
  const objects: Array<[string, string]> = [];
  const add = (owner: string, name?: string | null) => { if (owner && name) objects.push([owner, name]); };
  for (const s of await all<any>("story_photos", "story_id, file")) add(s.story_id, s.file);
  for (const s of await all<any>("slides", "story_id, image_file, locked_file, audio_file")) { add(s.story_id, s.image_file); add(s.story_id, s.locked_file); add(s.story_id, s.audio_file); }
  for (const p of await all<any>("portrait_photos", "portrait_id, file")) add(p.portrait_id, p.file);
  for (const p of await all<any>("portraits", "id, preview_file, clean_file")) { add(p.id, p.preview_file); add(p.id, p.clean_file); }
  for (const p of await all<any>("talk_photos", "video_id, file")) add(p.video_id, p.file);
  for (const v of await all<any>("videos", "id, preview_file, clean_file")) {
    add(v.id, v.preview_file); add(v.id, v.clean_file);
    for (const n of ["source.jpg", "source_hd.jpg", "audio.mp3"]) add(v.id, n);
  }
  for (const p of await all<any>("pets", "id, photo_file")) add(p.id, p.photo_file);
  for (const m of await all<any>("memories", "id, photo_file")) add(m.id, m.photo_file);
  for (const id of VOICES) add("voicesamples", `${id}.mp3`);

  const todo = objects.filter(([o, n]) => !copied.has(`${o}/${n}`));
  console.log(`objects: ${objects.length}, to copy: ${todo.length}`);
  let key = await legacyKey();
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const [owner, name] = todo.shift()!;
      let r = await fetch(`${LEGACY}/objects/petito/${owner}/${name}`, { headers: { "X-Storage-Key": key } });
      if (r.status === 401 || r.status === 403) { key = await legacyKey(); r = await fetch(`${LEGACY}/objects/petito/${owner}/${name}`, { headers: { "X-Storage-Key": key } }); }
      if (!r.ok) { missing.push(`${owner}/${name} (${r.status})`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const type = name.endsWith(".mp3") ? "audio/mpeg" : name.endsWith(".mp4") ? "video/mp4" : r.headers.get("content-type") || "image/jpeg";
      const { error } = await sb.storage.from("media").upload(`${owner}/${name}`, buf, { contentType: type, upsert: true });
      if (error) { missing.push(`${owner}/${name} (upload: ${error.message})`); continue; }
      copied.add(`${owner}/${name}`);
      if (++done % 50 === 0) { writeFileSync(copiedFile, JSON.stringify([...copied])); console.log(`copied ${done}`); }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  writeFileSync(copiedFile, JSON.stringify([...copied]));
  writeFileSync(path.join(OUT, "missing.json"), JSON.stringify(missing, null, 2));
  console.log(`done: copied ${done}, missing ${missing.length}`);
})().catch((e) => { console.error(e); process.exit(1); });

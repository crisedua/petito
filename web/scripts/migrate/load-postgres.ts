/**
 * Step 2: transform the NDJSON dump and upsert it into Supabase Postgres. Idempotent: rerunning only
 * updates/inserts. Rows whose parent is missing are written to out/orphans.json instead.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { COLLECTIONS, OUT, readNdjson, schemaColumns, supabase } from "./shared";

const cols = schemaColumns();
const sb = supabase();
const seen: Record<string, Set<string>> = {};
const orphans: Record<string, unknown[]> = {};

/** Parent table checks: [column, parent table] (nullable FKs are nulled instead of skipped). */
const REQUIRED_FK: Record<string, Array<[string, string]>> = {
  subscriptions: [["user_id", "app_users"]],
  pets: [["user_id", "app_users"]],
  memories: [["pet_id", "pets"], ["user_id", "app_users"]],
  story_photos: [["story_id", "stories"]],
  slides: [["story_id", "stories"]],
  portrait_photos: [["portrait_id", "portraits"]],
  talk_photos: [["video_id", "videos"]],
};
const OPTIONAL_FK: Record<string, Array<[string, string]>> = {
  stories: [["user_id", "app_users"], ["pet_id", "pets"]],
  portraits: [["user_id", "app_users"], ["pet_id", "pets"]],
  videos: [["user_id", "app_users"], ["pet_id", "pets"]],
};

function transform(table: string, d: any): any {
  const r: any = { ...d };
  if (table === "app_users") r.email = String(d.email ?? "").trim().toLowerCase();
  if (table === "story_photos") r.idx = d.index;
  if (table === "slides") r.ord = d.order;
  if (table === "generation_logs") r.owner_id = d.story_id;
  if (["stories", "portraits", "videos"].includes(table)) for (const k of ["preview_file", "clean_file", "progress_step"]) r[k] ??= "";
  const out: any = {};
  for (const c of cols[table]) if (r[c] !== undefined) out[c] = r[c];
  return out;
}

(async () => {
  for (const { mongo, table, key } of COLLECTIONS) {
    seen[table] = new Set();
    const batch: any[] = [];
    let total = 0, skipped = 0;
    const flush = async () => {
      if (!batch.length) return;
      const { error } = await sb.from(table).upsert(batch, { onConflict: key, defaultToNull: false });
      if (error) throw new Error(`${table}: ${error.message}`);
      total += batch.length;
      batch.length = 0;
    };
    const emails = new Set<string>();
    for await (const raw of readNdjson(path.join(OUT, `${mongo}.ndjson`))) {
      const row = transform(table, raw);
      if (table === "app_users") {
        if (!row.email || emails.has(row.email)) { skipped++; continue; }
        emails.add(row.email);
      }
      const missing = (REQUIRED_FK[table] ?? []).find(([c, p]) => !row[c] || !seen[p]?.has(row[c]));
      if (missing) { (orphans[table] ??= []).push(raw); skipped++; continue; }
      for (const [c, p] of OPTIONAL_FK[table] ?? []) if (row[c] && !seen[p]?.has(row[c])) row[c] = null;
      seen[table].add(row[key]);
      batch.push(row);
      if (batch.length >= 500) await flush();
    }
    await flush();
    console.log(`${table}: upserted ${total}, skipped ${skipped}`);
  }
  writeFileSync(path.join(OUT, "orphans.json"), JSON.stringify(orphans, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

config({ path: path.join(__dirname, "..", "..", ".env.local") });
config({ path: path.join(__dirname, "..", "..", ".env") });

export const OUT = path.join(__dirname, "out");
mkdirSync(OUT, { recursive: true });

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const supabase = () =>
  createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

/** Mongo collection → Postgres table. */
export const COLLECTIONS: Array<{ mongo: string; table: string; key: string }> = [
  { mongo: "users", table: "app_users", key: "user_id" },
  { mongo: "subscriptions", table: "subscriptions", key: "mp_id" },
  { mongo: "pets", table: "pets", key: "id" },
  { mongo: "memories", table: "memories", key: "id" },
  { mongo: "stories", table: "stories", key: "id" },
  { mongo: "photos", table: "story_photos", key: "id" },
  { mongo: "slides", table: "slides", key: "id" },
  { mongo: "portraits", table: "portraits", key: "id" },
  { mongo: "portrait_photos", table: "portrait_photos", key: "id" },
  { mongo: "videos", table: "videos", key: "id" },
  { mongo: "talk_photos", table: "talk_photos", key: "id" },
  { mongo: "generation_logs", table: "generation_logs", key: "id" },
  { mongo: "survey_responses", table: "survey_responses", key: "id" },
];

/** Column names per table, parsed from the schema migration (single source of truth). */
export function schemaColumns(): Record<string, string[]> {
  const sql = readFileSync(path.join(__dirname, "..", "..", "supabase", "migrations", "0001_schema.sql"), "utf8");
  const out: Record<string, string[]> = {};
  for (const m of sql.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
    out[m[1]] = m[2].split("\n").map((l) => l.trim()).filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|primary|constraint)\b/.test(l)).map((l) => l.split(/\s+/)[0]);
  }
  return out;
}

export async function* readNdjson(file: string): AsyncGenerator<any> {
  if (!existsSync(file)) return;
  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) if (line.trim()) yield JSON.parse(line);
}

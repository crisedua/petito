/**
 * Landing showcase: up to three of the admin's own creations (portraits with their before photo,
 * talking videos) shown on the homepage so visitors see real transformations before uploading.
 * Stored as showcase/catalog.json. Only the admin's own creations can be featured.
 */
import * as storage from "./storage";
import { db } from "./db";
import { ALL_PORTRAIT_STYLES, SONG_STYLES, MOTION_SCENES } from "@/lib/catalogs";

const OWNER = "showcase";
const FILE = "catalog.json";
export const MAX_ITEMS = 3;

export type ShowcaseRef = { kind: "portrait" | "video"; id: string };
export type ShowcaseItem =
  | { kind: "portrait"; id: string; title: string; label: string; before: string; after: string; pet_name: string | null }
  | { kind: "video"; id: string; title: string; label: string; video: string; poster: string; pet_name: string | null; line: string | null };

export async function readRefs(): Promise<ShowcaseRef[]> {
  try {
    if (!(await storage.exists(OWNER, FILE))) return [];
    const d = JSON.parse((await storage.get(OWNER, FILE)).buf.toString("utf8"));
    return Array.isArray(d.items) ? d.items.filter((i: any) => ["portrait", "video"].includes(i?.kind) && typeof i?.id === "string").slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export const writeRefs = (items: ShowcaseRef[]) =>
  storage.put(OWNER, FILE, Buffer.from(JSON.stringify({ items: items.slice(0, MAX_ITEMS) })), "application/octet-stream");

const videoLabel = (v: any) =>
  v.mode === "song" ? `Canta ${SONG_STYLES[v.scenario]?.label ? `(${SONG_STYLES[v.scenario].label.toLowerCase()})` : ""}`.trim()
  : v.mode === "motion" ? (MOTION_SCENES[v.scenario]?.choreo ? "Baila" : "En movimiento")
  : "Te habla";

/** The featured items with everything the landing needs (the clean files: these are the admin's own, shown on purpose). */
export async function resolveShowcase(refs?: ShowcaseRef[]): Promise<ShowcaseItem[]> {
  const items = refs ?? await readRefs();
  const out: ShowcaseItem[] = [];
  for (const r of items) {
    if (r.kind === "portrait") {
      const { data: p } = await db().from("portraits").select("id, pet_name, style, status, clean_file, preview_file").eq("id", r.id).maybeSingle();
      if (!p || !["preview_ready", "paid"].includes(p.status) || !p.preview_file) continue;
      out.push({
        kind: "portrait", id: p.id, pet_name: p.pet_name, label: ALL_PORTRAIT_STYLES[p.style]?.label ?? "Retrato",
        title: p.pet_name ? `${p.pet_name}, en versión ${(ALL_PORTRAIT_STYLES[p.style]?.label ?? "retrato").toLowerCase()}` : "Retrato",
        before: storage.mediaPath(p.id, "orig_0.jpg"), after: storage.mediaPath(p.id, p.clean_file || p.preview_file),
      });
    } else {
      const { data: v } = await db().from("videos").select("id, pet_name, mode, scenario, status, line, clean_file, preview_file").eq("id", r.id).maybeSingle();
      if (!v || !["preview_ready", "paid"].includes(v.status) || !(v.clean_file || v.preview_file)) continue;
      out.push({
        kind: "video", id: v.id, pet_name: v.pet_name, label: videoLabel(v), line: v.line ?? null,
        title: v.pet_name ? `${v.pet_name} ${videoLabel(v).toLowerCase()}` : videoLabel(v),
        video: storage.mediaPath(v.id, v.clean_file || v.preview_file), poster: storage.mediaPath(v.id, v.clean_file ? "source_hd.jpg" : "source.jpg"),
      });
    }
  }
  return out;
}

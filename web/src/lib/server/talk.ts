import { db, iso } from "./db";
import { fail } from "./http";
import { mediaPath } from "./storage";
import { BRAND_URL } from "@/lib/catalogs";

export type VideoRow = Record<string, any> & { id: string; share_slug: string; status: string; mode: string };

export async function getVideo(id: string): Promise<VideoRow> {
  const { data } = await db().from("videos").select("*").eq("id", id).maybeSingle();
  if (!data) throw fail(404, "Video no encontrado");
  return expireStale(data as VideoRow);
}

/** A job still "generating" after 20 minutes is dead (lost or crashed run): fail it so screens stop spinning. */
const STALE_MS = 20 * 60_000;
async function expireStale(v: VideoRow): Promise<VideoRow> {
  if (v.status !== "generating" || Date.now() - new Date(v.created_at as any).getTime() < STALE_MS) return v;
  const patch = { status: "failed", progress_step: "Algo salió mal", progress_pct: 0, error: v.error || "Se demoró demasiado. Inténtalo de nuevo." };
  await db().from("videos").update(patch).eq("id", v.id).eq("status", "generating");
  return { ...v, ...patch } as VideoRow;
}

export async function getVideoBySlug(slug: string): Promise<VideoRow> {
  const { data } = await db().from("videos").select("*").eq("share_slug", slug).maybeSingle();
  if (!data) throw fail(404, "Video no encontrado");
  return data as VideoRow;
}

export const talkPublic = (v: VideoRow) => {
  const paid = v.status === "paid";
  return {
    id: v.id, slug: v.share_slug, pet_name: v.pet_name, mode: v.mode, status: v.status,
    progress_step: v.progress_step, progress_pct: v.progress_pct, line: v.line, price_clp: v.price_clp,
    paid, error: v.error, brand_url: BRAND_URL,
    preview_url: v.preview_file ? mediaPath(v.id, v.preview_file) : null,
    clean_url: paid && v.clean_file ? mediaPath(v.id, v.clean_file) : null,
    clean_ready: Boolean(v.clean_file),
    created_at: iso(v.created_at),
  };
};

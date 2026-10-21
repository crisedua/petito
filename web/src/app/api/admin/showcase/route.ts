import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { mediaPath } from "@/lib/server/storage";
import { MAX_ITEMS, readRefs, resolveShowcase, writeRefs, type ShowcaseRef } from "@/lib/server/showcase";
import { ALL_PORTRAIT_STYLES } from "@/lib/catalogs";

/** Admin → Muestras → Portada: what's featured now, and the admin's own creations to choose from. */
export const GET = handler(async (req: Request) => {
  const admin = await requireAdmin(req);
  const [refs, p, v] = await Promise.all([
    readRefs(),
    db().from("portraits").select("id, pet_name, style, status, clean_file, preview_file, created_at").eq("user_id", admin.user_id).in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(60),
    db().from("videos").select("id, pet_name, mode, scenario, status, line, clean_file, preview_file, created_at").eq("user_id", admin.user_id).eq("mode", "full").in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(60),
  ]);
  const chosen = new Set(refs.map((r) => `${r.kind}:${r.id}`));
  const candidates = [
    ...(p.data ?? []).map((d) => ({ kind: "portrait" as const, id: d.id, title: `${d.pet_name || "Retrato"} · ${ALL_PORTRAIT_STYLES[d.style]?.label ?? d.style}`, thumb: mediaPath(d.id, d.clean_file || d.preview_file), chosen: chosen.has(`portrait:${d.id}`), created_at: iso(d.created_at) })),
    ...(v.data ?? []).map((d) => ({ kind: "video" as const, id: d.id, title: `${d.pet_name || "Video"} · ${d.mode === "song" ? "canta" : d.mode === "motion" ? "se mueve" : "habla"}${d.line ? ` · “${String(d.line).slice(0, 40)}”` : ""}`, thumb: mediaPath(d.id, d.clean_file ? "source_hd.jpg" : "source.jpg"), chosen: chosen.has(`video:${d.id}`), created_at: iso(d.created_at) })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return json({ items: await resolveShowcase(refs), refs, candidates, max: MAX_ITEMS });
});

export const PUT = handler(async (req: Request) => {
  const admin = await requireAdmin(req);
  const b = await readJson<{ items?: ShowcaseRef[] }>(req);
  const items = (b.items ?? []).filter((i) => i && ["portrait", "video"].includes(i.kind) && typeof i.id === "string").slice(0, MAX_ITEMS);
  // Only the admin's own creations: the landing must never show a customer's pet.
  for (const i of items) {
    const { data } = await db().from(i.kind === "portrait" ? "portraits" : "videos").select("user_id").eq("id", i.id).maybeSingle();
    if (!data || data.user_id !== admin.user_id) throw fail(400, "Solo puedes destacar tus propias creaciones");
  }
  await writeRefs(items);
  return json({ items: await resolveShowcase(items) });
});

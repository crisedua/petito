import { handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const [s, p, v] = await Promise.all([
    db().from("stories").select("id, share_slug, pet_name, status, email, created_at").neq("status", "draft").order("created_at", { ascending: false }).limit(500),
    db().from("portraits").select("id, share_slug, pet_name, status, created_at").order("created_at", { ascending: false }).limit(500),
    db().from("videos").select("id, share_slug, pet_name, status, created_at").order("created_at", { ascending: false }).limit(500),
  ]);
  const out = [
    ...(s.data ?? []).map((d) => ({ kind: "story", id: d.id, slug: d.share_slug, title: d.pet_name || "Historia", status: d.status, paid: d.status === "paid", view_path: `/h/${d.share_slug}`, email: d.email, created_at: iso(d.created_at) })),
    ...(p.data ?? []).map((d) => ({ kind: "portrait", id: d.id, slug: d.share_slug, title: d.pet_name || "Retrato", status: d.status, paid: d.status === "paid", view_path: `/r/${d.share_slug}`, created_at: iso(d.created_at) })),
    ...(v.data ?? []).map((d) => ({ kind: "video", id: d.id, slug: d.share_slug, title: d.pet_name || "Video", status: d.status, paid: d.status === "paid", view_path: `/v/${d.share_slug}`, created_at: iso(d.created_at) })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return json(out);
});

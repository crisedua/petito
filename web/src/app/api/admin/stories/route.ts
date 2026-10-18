import { handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { THEMES } from "@/lib/catalogs";

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const filter = new URL(req.url).searchParams.get("filter") ?? "all";
  let q = db().from("stories").select("*");
  if (filter === "paid") q = q.eq("status", "paid");
  else if (filter === "pending") q = q.in("status", ["preview_ready", "generating", "failed"]);
  else q = q.neq("status", "draft");
  const { data } = await q.order("created_at", { ascending: false }).limit(500);
  return json((data ?? []).map((d) => ({
    id: d.id, slug: d.share_slug, pet_name: d.pet_name, species: d.species, theme: THEMES[d.theme]?.label ?? d.theme,
    photo_count: d.photo_count ?? 0, status: d.status, paid: d.status === "paid",
    ai_cost_clp: Math.round(Number(d.ai_cost_usd ?? 0) * env.usdToClp), created_at: iso(d.created_at), email: d.email,
  })));
});

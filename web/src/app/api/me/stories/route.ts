import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { mediaPath } from "@/lib/server/storage";
import { env } from "@/lib/server/env";
import { THEMES } from "@/lib/catalogs";

export const GET = handler(async (req: Request) => {
  const user = await requireUser(req);
  const { data } = await db().from("stories").select("*").eq("user_id", user.user_id).neq("status", "draft").order("created_at", { ascending: false }).limit(200);
  return json((data ?? []).map((d) => ({
    id: d.id, slug: d.share_slug, pet_name: d.pet_name, title: d.title,
    theme_label: THEMES[d.theme]?.label ?? d.theme, status: d.status,
    paid: d.status === "paid" || env.freeMode, thumb_url: mediaPath(d.id, "slide_0.jpg"), created_at: iso(d.created_at),
  })));
});

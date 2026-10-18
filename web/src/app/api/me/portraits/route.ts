import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { mediaPath } from "@/lib/server/storage";
import { ALL_PORTRAIT_STYLES } from "@/lib/catalogs";

export const GET = handler(async (req: Request) => {
  const user = await requireUser(req);
  const { data } = await db().from("portraits").select("*").eq("user_id", user.user_id).in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(200);
  return json((data ?? []).map((d) => ({
    id: d.id, slug: d.share_slug, pet_name: d.pet_name,
    style_label: ALL_PORTRAIT_STYLES[d.style]?.label ?? d.style, category: d.category ?? "royal",
    status: d.status, paid: d.status === "paid", thumb_url: mediaPath(d.id, "preview.jpg"),
    gift_enabled: d.gift_enabled ?? false, created_at: iso(d.created_at),
  })));
});

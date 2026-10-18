import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { mediaPath } from "@/lib/server/storage";

export const GET = handler(async (req: Request) => {
  const user = await requireUser(req);
  const { data } = await db().from("videos").select("*").eq("user_id", user.user_id).eq("mode", "full").in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(200);
  return json((data ?? []).map((d) => ({
    id: d.id, slug: d.share_slug, pet_name: d.pet_name, line: d.line, status: d.status, paid: d.status === "paid",
    thumb_url: mediaPath(d.id, "source.jpg"),
    preview_url: d.preview_file ? mediaPath(d.id, d.preview_file) : null,
    created_at: iso(d.created_at),
  })));
});

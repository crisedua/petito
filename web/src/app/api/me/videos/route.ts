import { isPlus } from "@/lib/server/plus";
import { portraitThumb, videoThumb } from "@/lib/server/thumbs";
import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { mediaPath } from "@/lib/server/storage";

export const GET = handler(async (req: Request) => {
  const user = await requireUser(req);
  const plus = await isPlus(user.user_id);
  const { data } = await db().from("videos").select("*").eq("user_id", user.user_id).eq("mode", "full").in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(200);
  return json((data ?? []).map((d) => ({
    id: d.id, slug: d.share_slug, pet_name: d.pet_name, line: d.line, status: d.status, paid: d.status === "paid" || plus,
    thumb_url: videoThumb(d, plus),
    preview_url: d.preview_file ? mediaPath(d.id, d.preview_file) : null,
    created_at: iso(d.created_at),
  })));
});
